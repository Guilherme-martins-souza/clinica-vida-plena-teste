import { Router } from 'express';
import { isValidObjectId, type HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../errors';
import { montarCsvDescartes, nomeDoRelatorio } from '../importacao/relatorio';
import { Importacao, MOTIVOS_DESCARTE, type DadosImportacao, type Descarte } from '../models/importacao';
import { inicioDaPagina, lerPaginacao, type Pagina } from '../paginacao';

type ImportacaoDoc = HydratedDocument<DadosImportacao>;

export const importacoesRouter = Router();

// Formato da resposta: "id" no lugar de "_id" e sem "__v".
// minimize: false mantém as contagens vazias como {} em vez de sumir com o campo.
function paraResposta(importacao: ImportacaoDoc) {
  const { _id, __v, ...dados } = importacao.toObject({ minimize: false });
  return { id: String(_id), ...dados };
}

// `campos` escolhe o que vem do banco (select do Mongoose), para não carregar as linhas descartadas à toa.
async function buscarImportacao(id: string, campos: string): Promise<ImportacaoDoc> {
  const importacao = isValidObjectId(id) ? await Importacao.findById(id).select(campos) : null;
  if (!importacao) {
    throw new HttpError(404, 'IMPORTACAO_NAO_ENCONTRADA', 'Importação não encontrada');
  }
  return importacao;
}

// Lista sem as linhas descartadas, da mais recente para a mais antiga.
importacoesRouter.get('/', async (_req, res) => {
  const importacoes = await Importacao.find().select('-descartes').sort({ iniciadaEm: -1 });
  res.json(importacoes.map(paraResposta));
});

// Detalhe sem as linhas descartadas: elas vêm paginadas em /:id/descartes.
importacoesRouter.get('/:id', async (req, res) => {
  const importacao = await buscarImportacao(req.params.id, '-descartes');
  res.json(paraResposta(importacao));
});

const filtroDescartesSchema = z.object({ motivo: z.enum(MOTIVOS_DESCARTE).optional() });

// Linhas descartadas, paginadas no banco e na ordem do arquivo. ?motivo= filtra por um motivo.
importacoesRouter.get('/:id/descartes', async (req, res) => {
  const importacao = await buscarImportacao(req.params.id, '_id');
  const paginacao = lerPaginacao(req.query);
  const filtro = filtroDescartesSchema.safeParse(req.query);
  if (!filtro.success) {
    throw new HttpError(400, 'MOTIVO_INVALIDO', 'Motivo de descarte desconhecido');
  }
  const { motivo } = filtro.data;

  // As linhas ficam num array dentro da importação: o $filter aplica o motivo e o $slice corta a página,
  // tudo no Mongo, sem trazer as outras linhas para o Node.
  const [resultado] = await Importacao.aggregate<{ total: number; itens: Descarte[] }>([
    { $match: { _id: importacao._id } },
    {
      $project: {
        linhas: motivo ? { $filter: { input: '$descartes', cond: { $eq: ['$$this.motivo', motivo] } } } : '$descartes',
      },
    },
    {
      $project: {
        _id: 0,
        total: { $size: '$linhas' },
        itens: { $slice: ['$linhas', inicioDaPagina(paginacao), paginacao.porPagina] },
      },
    },
  ]);

  const pagina: Pagina<Descarte> = {
    itens: resultado?.itens ?? [],
    total: resultado?.total ?? 0,
    ...paginacao,
  };
  res.json(pagina);
});

// Gerado do documento no banco a cada pedido: não depende do arquivo em data/relatorios.
importacoesRouter.get('/:id/descartes.csv', async (req, res) => {
  const importacao = await buscarImportacao(req.params.id, 'iniciadaEm descartes');
  const arquivo = `${nomeDoRelatorio(importacao.iniciadaEm)}-descartes.csv`;

  res.attachment(arquivo);
  res.type('text/csv; charset=utf-8');
  res.send(montarCsvDescartes(importacao.descartes));
});

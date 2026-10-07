import { Router } from 'express';
import { isValidObjectId, type HydratedDocument } from 'mongoose';
import { HttpError } from '../errors';
import { montarCsvDescartes, nomeDoRelatorio } from '../importacao/relatorio';
import { Importacao, type DadosImportacao } from '../models/importacao';

type ImportacaoDoc = HydratedDocument<DadosImportacao>;

export const importacoesRouter = Router();

// Formato da resposta: "id" no lugar de "_id" e sem "__v".
// minimize: false mantém as contagens vazias como {} em vez de sumir com o campo.
function paraResposta(importacao: ImportacaoDoc) {
  const { _id, __v, ...dados } = importacao.toObject({ minimize: false });
  return { id: String(_id), ...dados };
}

async function buscarImportacao(id: string): Promise<ImportacaoDoc> {
  const importacao = isValidObjectId(id) ? await Importacao.findById(id) : null;
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

importacoesRouter.get('/:id', async (req, res) => {
  const importacao = await buscarImportacao(req.params.id);
  res.json(paraResposta(importacao));
});

// Gerado do documento no banco a cada pedido: não depende do arquivo em data/relatorios.
importacoesRouter.get('/:id/descartes.csv', async (req, res) => {
  const importacao = await buscarImportacao(req.params.id);
  const arquivo = `${nomeDoRelatorio(importacao.iniciadaEm)}-descartes.csv`;

  res.attachment(arquivo);
  res.type('text/csv; charset=utf-8');
  res.send(montarCsvDescartes(importacao.descartes));
});

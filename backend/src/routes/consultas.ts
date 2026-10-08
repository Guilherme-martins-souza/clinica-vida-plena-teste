import { Router } from 'express';
import { z } from 'zod';
import { alterarStatus } from '../consultas/alterar-status';
import { criarConsulta, type ConsultaDoc } from '../consultas/criar-consulta';
import { ABAS, contarAbas, listarConsultas, type FiltroConsultas } from '../consultas/listar-consultas';
import { HttpError } from '../errors';
import { ehDataIso } from '../fuso';
import { STATUS_CONSULTA, TIPOS_ATENDIMENTO } from '../models/consulta';
import { lerPaginacao } from '../paginacao';

export const consultasRouter = Router();

// Formato de uma consulta na resposta: "id" no lugar de "_id".
function paraResposta(consulta: ConsultaDoc) {
  return {
    id: String(consulta._id),
    codigoLegado: consulta.codigoLegado,
    pacienteId: consulta.pacienteId,
    medicoId: consulta.medicoId,
    tipoAtendimento: consulta.tipoAtendimento,
    inicio: consulta.inicio,
    marcadaEm: consulta.marcadaEm,
    canceladaEm: consulta.canceladaEm,
    status: consulta.status,
    consideradoFalta: consulta.consideradoFalta,
  };
}

// Filtros da lista e das contagens: ?aba=hoje&busca=joao&status=agendada&medicoId=MED01&de=2026-01-01&ate=2026-01-31
const dataIso = z.string().refine(ehDataIso);
const filtroSchema = z
  .object({
    aba: z.enum(ABAS).default('todas'),
    busca: z.string().trim().optional(),
    status: z.enum(STATUS_CONSULTA).optional(),
    medicoId: z.string().trim().optional(),
    de: dataIso.optional(),
    ate: dataIso.optional(),
  })
  // As datas são AAAA-MM-DD, então comparar o texto compara as datas.
  .refine((filtro) => !filtro.de || !filtro.ate || filtro.de <= filtro.ate);

function lerFiltro(query: unknown): FiltroConsultas {
  const filtro = filtroSchema.safeParse(query);
  if (!filtro.success) {
    throw new HttpError(
      400,
      'FILTRO_INVALIDO',
      `Filtro inválido: aba deve ser ${ABAS.join(', ')}; status um dos status da consulta; de e ate datas AAAA-MM-DD, com de até ate.`,
    );
  }
  return filtro.data;
}

consultasRouter.get('/', async (req, res) => {
  const filtro = lerFiltro(req.query);
  const paginacao = lerPaginacao(req.query);
  res.json(await listarConsultas(filtro, paginacao, new Date()));
});

consultasRouter.get('/contagens', async (req, res) => {
  const { aba: _aba, ...filtro } = lerFiltro(req.query);
  res.json(await contarAbas(filtro, new Date()));
});

// inicio em ISO 8601 com fuso, ex.: "2026-10-12T09:00:00-03:00" (ou terminando em Z).
const novaConsultaSchema = z.object({
  pacienteId: z.string().trim().min(1),
  medicoId: z.string().trim().min(1),
  tipoAtendimento: z.enum(TIPOS_ATENDIMENTO),
  inicio: z.iso.datetime({ offset: true }).transform((texto) => new Date(texto)),
});

consultasRouter.post('/', async (req, res) => {
  const dados = novaConsultaSchema.safeParse(req.body);
  if (!dados.success) {
    throw new HttpError(
      400,
      'DADOS_INVALIDOS',
      'Informe pacienteId, medicoId, tipoAtendimento (convenio ou particular) e inicio (data e hora com fuso).',
    );
  }

  const consulta = await criarConsulta(dados.data, new Date());
  res.status(201).json(paraResposta(consulta));
});

const novoStatusSchema = z.object({ status: z.enum(STATUS_CONSULTA) });

consultasRouter.patch('/:id/status', async (req, res) => {
  const dados = novoStatusSchema.safeParse(req.body);
  if (!dados.success) {
    throw new HttpError(400, 'DADOS_INVALIDOS', `Informe o status: ${STATUS_CONSULTA.join(', ')}.`);
  }

  const consulta = await alterarStatus(req.params.id, dados.data.status, new Date());
  res.json(paraResposta(consulta));
});

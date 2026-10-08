import { Router } from 'express';
import { z } from 'zod';
import { primeirasConsultas } from '../consultas/listar-consultas';
import { HttpError } from '../errors';
import { diaSeguinte, ehDataIso, inicioDoDia } from '../fuso';
import { calcularIndicadores, type ConsultaParaIndicador } from '../indicadores/calcular';
import { Consulta } from '../models/consulta';
import { Medico } from '../models/medico';

export const indicadoresRouter = Router();

// ?de=AAAA-MM-DD&ate=AAAA-MM-DD: dias de início da consulta, inclusive, em São Paulo.
const dataIso = z.string().refine(ehDataIso);
const periodoSchema = z
  .object({ de: dataIso, ate: dataIso })
  // As datas são AAAA-MM-DD, então comparar o texto compara as datas.
  .refine((periodo) => periodo.de <= periodo.ate);

// Consultas com início em [desde, ate), só com os campos que o cálculo usa
// (o pacienteId serve para achar as primeiras consultas).
async function consultasEntre(desde: Date, ate: Date): Promise<(ConsultaParaIndicador & { pacienteId: string })[]> {
  const consultas = await Consulta.find({ inicio: { $gte: desde, $lt: ate } })
    .select('medicoId pacienteId tipoAtendimento inicio marcadaEm canceladaEm status consideradoFalta')
    .lean();
  return consultas.map((consulta) => ({
    id: String(consulta._id),
    pacienteId: consulta.pacienteId,
    medicoId: consulta.medicoId,
    tipoAtendimento: consulta.tipoAtendimento,
    inicio: consulta.inicio,
    marcadaEm: consulta.marcadaEm,
    canceladaEm: consulta.canceladaEm,
    status: consulta.status,
    consideradoFalta: consulta.consideradoFalta,
  }));
}

indicadoresRouter.get('/', async (req, res) => {
  const periodo = periodoSchema.safeParse(req.query);
  if (!periodo.success) {
    throw new HttpError(400, 'PERIODO_INVALIDO', 'Informe de e ate no formato AAAA-MM-DD, com de até ate.');
  }
  const { de, ate } = periodo.data;

  // Período anterior: o mesmo número de dias, terminando no dia antes de "de".
  // O fuso é fixo (AD-002), então todo dia tem exatamente 24 h.
  const inicio = inicioDoDia(de);
  const fim = inicioDoDia(diaSeguinte(ate));
  const inicioAnterior = new Date(inicio.getTime() - (fim.getTime() - inicio.getTime()));

  const [consultas, anteriores, medicos] = await Promise.all([
    consultasEntre(inicio, fim),
    consultasEntre(inicioAnterior, inicio),
    Medico.find().sort({ nome: 1 }).lean(),
  ]);
  const primeiras = await primeirasConsultas([...new Set(consultas.map((consulta) => consulta.pacienteId))]);

  res.json(
    calcularIndicadores({
      periodo: { de, ate },
      consultas,
      anteriores,
      medicos,
      primeiras,
    }),
  );
});

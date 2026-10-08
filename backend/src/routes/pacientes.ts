import { Router } from 'express';
import { z } from 'zod';
import { regexDeBusca } from '../busca';
import { HttpError } from '../errors';
import { ehFaltoso, historicoDe } from '../historico/historico';
import { Consulta } from '../models/consulta';
import { Paciente } from '../models/paciente';
import { inicioDaPagina, lerPaginacao, type Pagina } from '../paginacao';

export const pacientesRouter = Router();

interface PacienteResposta {
  id: string;
  nome: string;
  telefone: string | null;
  concluidas: number;
  faltas: number;
  // true quando o paciente não tem nenhuma consulta não cancelada: a próxima que ele marcar é a 1ª na clínica.
  primeiraConsulta: boolean;
  // true quando tem 25% ou mais de faltas nos 5 últimos atendimentos (chip "faltoso").
  faltoso: boolean;
}

const filtroSchema = z.object({ busca: z.string().trim().optional() });

// Lista paginada por nome, com ?busca= por trecho do nome. Concluídas e faltas são de todo o histórico,
// com a mesma regra dos indicadores: o campo `consideradoFalta` da consulta.
pacientesRouter.get('/', async (req, res) => {
  const paginacao = lerPaginacao(req.query);
  const lido = filtroSchema.safeParse(req.query);
  if (!lido.success) {
    throw new HttpError(400, 'FILTRO_INVALIDO', 'Informe busca uma vez só, com um trecho do nome.');
  }
  const { busca } = lido.data;
  const filtro = busca ? { nome: regexDeBusca(busca) } : {};

  const [pacientes, total] = await Promise.all([
    Paciente.find(filtro).sort({ nome: 1, _id: 1 }).skip(inicioDaPagina(paginacao)).limit(paginacao.porPagina).lean(),
    Paciente.countDocuments(filtro),
  ]);

  // Concluídas, faltas e faltoso de todo o histórico, em uma busca só para a página.
  const historicos = await historicoDe(
    pacientes.map((paciente) => paciente._id),
    new Date(),
  );

  // Pacientes da página que já têm alguma consulta não cancelada (para a etiqueta "1ª consulta" do agendamento).
  const comConsulta = await Consulta.distinct('pacienteId', {
    pacienteId: { $in: pacientes.map((paciente) => paciente._id) },
    status: { $nin: ['cancelada_paciente', 'cancelada_clinica'] },
  });
  const jaVieram = new Set(comConsulta.map(String));

  const pagina: Pagina<PacienteResposta> = {
    itens: pacientes.map((paciente) => ({
      id: paciente._id,
      nome: paciente.nome,
      telefone: paciente.telefone,
      concluidas: historicos.get(paciente._id)?.atendimentos ?? 0,
      faltas: historicos.get(paciente._id)?.faltas ?? 0,
      primeiraConsulta: !jaVieram.has(paciente._id),
      faltoso: ehFaltoso(historicos.get(paciente._id) ?? { faltas: 0, atendimentos: 0, ultimos5: [] }),
    })),
    total,
    ...paginacao,
  };
  res.json(pagina);
});

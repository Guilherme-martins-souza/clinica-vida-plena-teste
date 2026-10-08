import { Router } from 'express';
import { z } from 'zod';
import { regexDeBusca } from '../busca';
import { HttpError } from '../errors';
import { resultado } from '../indicadores/calcular';
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
}

const filtroSchema = z.object({ busca: z.string().trim().optional() });

// Lista paginada por nome, com ?busca= por trecho do nome. Concluídas e faltas são de todo o histórico,
// com a mesma regra dos indicadores (cancelamento do paciente a menos de 24 h conta como falta).
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

  // Consultas que podem contar como concluída, só dos pacientes da página.
  const consultas = await Consulta.find({
    pacienteId: { $in: pacientes.map((paciente) => paciente._id) },
    status: { $in: ['realizada', 'falta', 'cancelada_paciente'] },
  })
    .select('pacienteId status inicio canceladaEm')
    .lean();

  // Pacientes da página que já têm alguma consulta não cancelada (para a etiqueta "1ª consulta" do agendamento).
  const comConsulta = await Consulta.distinct('pacienteId', {
    pacienteId: { $in: pacientes.map((paciente) => paciente._id) },
    status: { $nin: ['cancelada_paciente', 'cancelada_clinica'] },
  });
  const jaVieram = new Set(comConsulta.map(String));

  const contagens = new Map(pacientes.map((paciente) => [paciente._id, { concluidas: 0, faltas: 0 }]));
  for (const consulta of consultas) {
    const r = resultado(consulta);
    const contagem = contagens.get(consulta.pacienteId);
    if (contagem && (r === 'realizada' || r === 'falta')) {
      contagem.concluidas += 1;
      if (r === 'falta') {
        contagem.faltas += 1;
      }
    }
  }

  const pagina: Pagina<PacienteResposta> = {
    itens: pacientes.map((paciente) => ({
      id: paciente._id,
      nome: paciente.nome,
      telefone: paciente.telefone,
      ...(contagens.get(paciente._id) ?? { concluidas: 0, faltas: 0 }),
      primeiraConsulta: !jaVieram.has(paciente._id),
    })),
    total,
    ...paginacao,
  };
  res.json(pagina);
});

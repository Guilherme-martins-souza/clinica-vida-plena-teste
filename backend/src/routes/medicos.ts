import { Router } from 'express';
import { z } from 'zod';
import { horariosDoDia } from '../consultas/horarios';
import { HttpError } from '../errors';
import { ehDataIso } from '../fuso';
import { Medico, type HorarioGrade } from '../models/medico';
import { inicioDaPagina, lerPaginacao, type Pagina } from '../paginacao';

export const medicosRouter = Router();

interface MedicoResposta {
  id: string;
  nome: string;
  especialidade: string;
  grade: HorarioGrade[];
}

// Lista paginada por nome. A trava versaoAgenda é interna e não vai na resposta.
medicosRouter.get('/', async (req, res) => {
  const paginacao = lerPaginacao(req.query);
  const [medicos, total] = await Promise.all([
    Medico.find().sort({ nome: 1, _id: 1 }).skip(inicioDaPagina(paginacao)).limit(paginacao.porPagina).lean(),
    Medico.countDocuments(),
  ]);

  const pagina: Pagina<MedicoResposta> = {
    itens: medicos.map((medico) => ({
      id: medico._id,
      nome: medico.nome,
      especialidade: medico.especialidade,
      grade: medico.grade.map(({ dia, inicio, fim }) => ({ dia, inicio, fim })),
    })),
    total,
    ...paginacao,
  };
  res.json(pagina);
});

const horariosSchema = z.object({ data: z.string().refine(ehDataIso) });

// Slots do médico num dia: ?data=AAAA-MM-DD (São Paulo).
medicosRouter.get('/:id/horarios', async (req, res) => {
  const filtro = horariosSchema.safeParse(req.query);
  if (!filtro.success) {
    throw new HttpError(400, 'FILTRO_INVALIDO', 'Informe a data no formato AAAA-MM-DD.');
  }

  res.json(await horariosDoDia(req.params.id, filtro.data.data, new Date()));
});

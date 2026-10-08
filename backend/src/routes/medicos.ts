import { Router } from 'express';
import { z } from 'zod';
import { horariosDoDia } from '../consultas/horarios';
import { HttpError } from '../errors';
import { ehDataIso } from '../fuso';

export const medicosRouter = Router();

const horariosSchema = z.object({ data: z.string().refine(ehDataIso) });

// Slots do médico num dia: ?data=AAAA-MM-DD (São Paulo).
medicosRouter.get('/:id/horarios', async (req, res) => {
  const filtro = horariosSchema.safeParse(req.query);
  if (!filtro.success) {
    throw new HttpError(400, 'FILTRO_INVALIDO', 'Informe a data no formato AAAA-MM-DD.');
  }

  res.json(await horariosDoDia(req.params.id, filtro.data.data, new Date()));
});

import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors';
import { lerPaginacao } from '../paginacao';
import { listarPrevencao } from '../prevencao/listar';
import { CORTES, FATORES, PESOS } from '../risco/pesos';

export const prevencaoRouter = Router();

const NIVEIS = ['media', 'alta', 'muito_alta'] as const;
const filtroSchema = z.object({ nivel: z.enum(NIVEIS).optional() });

// Lista da aba: ?nivel=media|alta|muito_alta&pagina=1&porPagina=10
prevencaoRouter.get('/', async (req, res) => {
  const filtro = filtroSchema.safeParse(req.query);
  if (!filtro.success) {
    throw new HttpError(400, 'FILTRO_INVALIDO', `Filtro inválido: nivel deve ser ${NIVEIS.join(', ')}.`);
  }
  const paginacao = lerPaginacao(req.query);
  res.json(await listarPrevencao(filtro.data, paginacao, new Date()));
});

// Pesos, cortes e rótulos da conta do risco, para o banner da tela (vêm da fonte única).
prevencaoRouter.get('/regras', (_req, res) => {
  res.json({
    pesos: PESOS,
    cortes: CORTES,
    fatores: FATORES.map((fator) => ({ ...fator, pontos: PESOS[fator.codigo] })),
  });
});

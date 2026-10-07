import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../errors';

// Executado quando nenhuma rota respondeu.
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não encontrada` },
  });
};

// O Express reconhece um middleware de erro por ter 4 parâmetros.
// `err` é declarado como unknown porque o tipo do Express usa any.
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // Corpo da requisição com JSON malformado (lançado pelo express.json()).
  if (err instanceof Error && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Corpo da requisição não é um JSON válido' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } });
};

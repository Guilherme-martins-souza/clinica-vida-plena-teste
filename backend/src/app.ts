import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { healthRouter } from './routes/health';
import { importacoesRouter } from './routes/importacoes';

export const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/importacoes', importacoesRouter);

// A ordem importa: 404 e erros sempre por último.
app.use(notFoundHandler);
app.use(errorHandler);

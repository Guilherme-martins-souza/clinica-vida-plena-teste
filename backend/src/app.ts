import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { consultasRouter } from './routes/consultas';
import { healthRouter } from './routes/health';
import { importacoesRouter } from './routes/importacoes';
import { medicosRouter } from './routes/medicos';

export const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/importacoes', importacoesRouter);
app.use('/api/consultas', consultasRouter);
app.use('/api/medicos', medicosRouter);

// A ordem importa: 404 e erros sempre por último.
app.use(notFoundHandler);
app.use(errorHandler);

import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { consultasRouter } from './routes/consultas';
import { healthRouter } from './routes/health';
import { importacoesRouter } from './routes/importacoes';
import { indicadoresRouter } from './routes/indicadores';
import { listaEsperaRouter } from './routes/lista-espera';
import { medicosRouter } from './routes/medicos';
import { pacientesRouter } from './routes/pacientes';
import { prevencaoRouter } from './routes/prevencao';

export const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/importacoes', importacoesRouter);
app.use('/api/consultas', consultasRouter);
app.use('/api/medicos', medicosRouter);
app.use('/api/indicadores', indicadoresRouter);
app.use('/api/pacientes', pacientesRouter);
app.use('/api/prevencao-de-faltas', prevencaoRouter);
app.use('/api/lista-espera', listaEsperaRouter);

// A ordem importa: 404 e erros sempre por último.
app.use(notFoundHandler);
app.use(errorHandler);

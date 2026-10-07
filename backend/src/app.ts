import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { healthRouter } from './routes/health';

export const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);

// A ordem importa: 404 e erros sempre por último.
app.use(notFoundHandler);
app.use(errorHandler);

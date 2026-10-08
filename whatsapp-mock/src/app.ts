import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { agruparPorTelefone, guardarMensagem } from './mensagens';
import { renderizarPagina } from './pagina';

export const app = express();

app.use(express.json());

app.post('/messages', (req, res) => {
  const { id } = guardarMensagem(req.body);
  res.status(201).json({ id });
});

app.get('/', (_req, res) => {
  res.type('html').send(renderizarPagina(agruparPorTelefone()));
});

// A ordem importa: 404 e erros sempre por último.
app.use(notFoundHandler);
app.use(errorHandler);

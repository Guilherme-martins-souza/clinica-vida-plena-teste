import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { agruparPorTelefone, contarMensagens, guardarMensagem } from './mensagens';
import { renderizarPagina } from './pagina';

export const app = express();

app.use(express.json());

app.post('/messages', (req, res) => {
  const { id } = guardarMensagem(req.body);
  res.status(201).json({ id });
});

app.get('/', (req, res) => {
  const telefone = typeof req.query.telefone === 'string' ? req.query.telefone : undefined;
  const busca = typeof req.query.q === 'string' ? req.query.q : '';
  res.type('html').send(renderizarPagina(agruparPorTelefone(), telefone, busca));
});

// Usada pela página para saber se chegou mensagem nova.
app.get('/status', (_req, res) => {
  res.json({ total: contarMensagens() });
});

// A ordem importa: 404 e erros sempre por último.
app.use(notFoundHandler);
app.use(errorHandler);

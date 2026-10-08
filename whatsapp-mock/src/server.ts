import { app } from './app';

const port = Number(process.env.PORT ?? 8025);

app.listen(port, () => {
  console.log(`WhatsApp simulado ouvindo em http://localhost:${port}`);
});

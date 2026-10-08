import mongoose from 'mongoose';
import { app } from './app';
import { env } from './config/env';
import { marcarInterrompidas } from './importacao/executar';
import { semearListaEspera } from './lista-espera/seed';
import { criarClienteWhatsapp } from './mensagens/cliente-whatsapp';
import { iniciarAgendador } from './mensagens/agendador';
import { configurarEnviador } from './mensagens/enviar';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB conectado');

  // A importação é um comando (npm run import); aqui só limpa as que ficaram presas por um processo que morreu.
  try {
    await marcarInterrompidas();
  } catch (err) {
    console.error('Falha ao marcar importações interrompidas:', err);
  }

  // Lista de espera de exemplo, só se a coleção está vazia (não depende da importação).
  try {
    await semearListaEspera();
  } catch (err) {
    console.error('Falha ao semear a lista de espera:', err);
  }

  if (env.WHATSAPP_URL) {
    configurarEnviador(criarClienteWhatsapp(env.WHATSAPP_URL));
  }
  iniciarAgendador();

  app.listen(env.PORT, () => {
    console.log(`API ouvindo em http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});

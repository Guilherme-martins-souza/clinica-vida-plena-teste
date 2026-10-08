import mongoose from 'mongoose';
import { app } from './app';
import { env } from './config/env';
import { marcarInterrompidas } from './importacao/executar';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB conectado');

  // A importação é um comando (npm run import); aqui só limpa as que ficaram presas por um processo que morreu.
  try {
    await marcarInterrompidas();
  } catch (err) {
    console.error('Falha ao marcar importações interrompidas:', err);
  }

  app.listen(env.PORT, () => {
    console.log(`API ouvindo em http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});

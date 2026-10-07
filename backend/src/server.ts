import mongoose from 'mongoose';
import { app } from './app';
import { env } from './config/env';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB conectado');

  app.listen(env.PORT, () => {
    console.log(`API ouvindo em http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});

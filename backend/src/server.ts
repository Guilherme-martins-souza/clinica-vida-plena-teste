import mongoose from 'mongoose';
import { app } from './app';
import { env } from './config/env';
import { importarSeNecessario, marcarInterrompidas } from './importacao/executar';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB conectado');

  // Importação automática: só roda se ainda não há importação concluída.
  // Se falhar, a API sobe mesmo assim e a tela Importações mostra a falha.
  try {
    await marcarInterrompidas();
    await importarSeNecessario(env.DATA_DIR);
  } catch (err) {
    console.error('Falha na importação automática:', err);
  }

  app.listen(env.PORT, () => {
    console.log(`API ouvindo em http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});

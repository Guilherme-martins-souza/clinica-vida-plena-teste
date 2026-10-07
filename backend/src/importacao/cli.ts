// Comando `npm run import`: apaga médicos, pacientes e consultas e importa os arquivos do zero.
import mongoose from 'mongoose';
import { env } from '../config/env';
import { executarImportacao } from './executar';

async function main(): Promise<number> {
  await mongoose.connect(env.MONGODB_URI);
  try {
    // O resumo da importação já é impresso por executarImportacao.
    const importacao = await executarImportacao({ origem: 'manual', dataDir: env.DATA_DIR });
    return importacao.situacao === 'concluida' ? 0 : 1;
  } finally {
    await mongoose.disconnect();
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

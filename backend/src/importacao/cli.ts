// Comando `npm run import`: apaga médicos, pacientes e consultas e importa os arquivos do zero.
// Também refaz a lista de espera: apaga e grava as pessoas de exemplo (3 por médico).
import mongoose from 'mongoose';
import { env } from '../config/env';
import { semearListaEspera } from '../lista-espera/seed';
import { ListaEspera } from '../models/lista-espera';
import { executarImportacao } from './executar';

async function main(): Promise<number> {
  await mongoose.connect(env.MONGODB_URI);
  try {
    // O resumo da importação já é impresso por executarImportacao.
    const importacao = await executarImportacao({ origem: 'manual', dataDir: env.DATA_DIR });
    if (importacao.situacao !== 'concluida') return 1;
    await ListaEspera.deleteMany({});
    await semearListaEspera();
    console.log('Lista de espera refeita com 3 pessoas de exemplo por médico.');
    return 0;
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

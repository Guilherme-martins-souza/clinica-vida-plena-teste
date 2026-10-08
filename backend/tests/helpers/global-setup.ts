import mongoose from 'mongoose';

// Roda uma vez antes e uma vez depois de toda a suíte (globalSetup do Vitest, em vitest.config.ts).
// Apaga os bancos clinica_test* que sobraram, inclusive de uma execução interrompida.

// Filtra os nomes dos bancos de teste. Nunca devolve banco que não comece com clinica_test.
export function bancosDeTeste(nomes: string[]): string[] {
  return nomes.filter((nome) => nome.startsWith('clinica_test'));
}

async function apagarBancosDeTeste(): Promise<void> {
  const uri = process.env.MONGODB_URI_TEST;
  if (!uri) {
    throw new Error('MONGODB_URI_TEST não definida: rode os testes pelo docker compose');
  }

  const conexao = await mongoose.createConnection(uri).asPromise();
  try {
    const { databases } = await conexao.client.db().admin().listDatabases();
    const nomes = databases.map((banco) => banco.name);
    for (const nome of bancosDeTeste(nomes)) {
      await conexao.client.db(nome).dropDatabase();
    }
  } finally {
    await conexao.close();
  }
}

export async function setup(): Promise<void> {
  await apagarBancosDeTeste();
}

export async function teardown(): Promise<void> {
  await apagarBancosDeTeste();
}

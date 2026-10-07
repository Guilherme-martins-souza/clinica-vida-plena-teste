import mongoose from 'mongoose';

// Conecta o mongoose a um banco só deste arquivo de teste (clinica_test_<nome>),
// para os arquivos rodarem em paralelo sem um apagar os dados do outro.
export async function conectarBancoDeTeste(nome: string): Promise<void> {
  const uri = process.env.MONGODB_URI_TEST;
  if (!uri) {
    throw new Error('MONGODB_URI_TEST não definida: rode os testes pelo docker compose');
  }

  const url = new URL(uri);
  url.pathname = `/clinica_test_${nome}`;

  await mongoose.connect(url.toString());
}

// Apaga os documentos de todas as coleções, mas mantém as coleções e seus índices.
export async function limparBanco(): Promise<void> {
  const colecoes = await mongoose.connection.db?.collections();
  for (const colecao of colecoes ?? []) {
    await colecao.deleteMany({});
  }
}

export async function desconectar(): Promise<void> {
  await mongoose.disconnect();
}

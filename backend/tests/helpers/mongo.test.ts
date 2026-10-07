import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conectarBancoDeTeste, desconectar, limparBanco } from './mongo';

beforeAll(async () => {
  await conectarBancoDeTeste('helpers_mongo');
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('banco de teste', () => {
  it('usa um banco próprio para o arquivo de teste', () => {
    expect(mongoose.connection.name).toBe('clinica_test_helpers_mongo');
  });

  it('desfaz o que foi gravado quando a transação é abortada', async () => {
    const colecao = mongoose.connection.collection('fumaca');
    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          await colecao.insertOne({ nome: 'teste' }, { session });
          // Dentro da transação o documento existe...
          expect(await colecao.countDocuments({}, { session })).toBe(1);
          // ...e ao lançar um erro a transação é abortada.
          throw new Error('abortar');
        }),
      ).rejects.toThrow('abortar');
    } finally {
      await session.endSession();
    }

    expect(await colecao.countDocuments({})).toBe(0);
  });
});

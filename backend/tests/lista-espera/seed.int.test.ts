import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { semearListaEspera } from '../../src/lista-espera/seed';
import { ListaEspera } from '../../src/models/lista-espera';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

beforeAll(async () => {
  await conectarBancoDeTeste('lista_espera_seed');
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('semearListaEspera', () => {
  it('coleção vazia: grava 3 pessoas para cada um dos 6 médicos', async () => {
    await semearListaEspera();

    const pessoas = await ListaEspera.find().lean();
    expect(pessoas).toHaveLength(18);
    for (const medicoId of ['MED01', 'MED02', 'MED03', 'MED04', 'MED05', 'MED06']) {
      expect(pessoas.filter((p) => p.medicoId === medicoId)).toHaveLength(3);
    }
  });

  it('telefones fictícios válidos (o schema recusa os inválidos)', async () => {
    await semearListaEspera();

    const pessoas = await ListaEspera.find().lean();
    for (const pessoa of pessoas) {
      expect(pessoa.telefone).toMatch(/^\d{10,11}$/);
    }
  });

  it('segunda chamada não duplica', async () => {
    await semearListaEspera();
    await semearListaEspera();

    expect(await ListaEspera.countDocuments()).toBe(18);
  });

  it('coleção com gente cadastrada não recebe o seed', async () => {
    await ListaEspera.create({ nome: 'Ana Lima', telefone: '5332221111' });
    await semearListaEspera();

    expect(await ListaEspera.countDocuments()).toBe(1);
  });
});

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
  it('coleção vazia: grava 5 pessoas, 2 com médico e 2 com antecipar', async () => {
    await semearListaEspera();

    const pessoas = await ListaEspera.find().lean();
    expect(pessoas).toHaveLength(5);
    expect(pessoas.filter((p) => p.medicoId !== null)).toHaveLength(2);
    expect(pessoas.filter((p) => p.antecipar)).toHaveLength(2);
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

    expect(await ListaEspera.countDocuments()).toBe(5);
  });

  it('coleção com gente cadastrada não recebe o seed', async () => {
    await ListaEspera.create({ nome: 'Ana Lima', telefone: '5332221111' });
    await semearListaEspera();

    expect(await ListaEspera.countDocuments()).toBe(1);
  });
});

import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ListaEspera } from '../../src/models/lista-espera';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// Tenta gravar e devolve o caminho dos campos recusados pela validação.
async function camposRecusados(dados: Record<string, unknown>): Promise<string[]> {
  try {
    await ListaEspera.create(dados);
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return Object.keys(err.errors);
    }
    throw err;
  }
  return [];
}

beforeAll(async () => {
  await conectarBancoDeTeste('models_lista_espera');
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('model ListaEspera', () => {
  it('grava com os padrões: antecipar false, medicoId null e data de cadastro', async () => {
    const antes = Date.now();
    const gravada = await ListaEspera.create({ nome: 'Ana Lima', telefone: '53948954499' });

    expect(gravada.antecipar).toBe(false);
    expect(gravada.medicoId).toBeNull();
    expect(gravada.criadoEm.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('aceita telefone de 10 e de 11 dígitos', async () => {
    expect(await camposRecusados({ nome: 'A', telefone: '5332221111' })).toEqual([]);
    expect(await camposRecusados({ nome: 'B', telefone: '53948954499' })).toEqual([]);
  });

  it.each(['123456789', '539489544990', '(53) 94895-4499', 'abcdefghij'])('recusa o telefone %s', async (telefone) => {
    expect(await camposRecusados({ nome: 'Ana', telefone })).toEqual(['telefone']);
  });

  it('recusa sem nome e sem telefone', async () => {
    expect((await camposRecusados({})).sort()).toEqual(['nome', 'telefone']);
  });
});

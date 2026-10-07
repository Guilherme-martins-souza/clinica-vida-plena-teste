import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Paciente, type DadosPaciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// Tenta gravar e devolve o caminho dos campos recusados pela validação.
async function camposRecusados(dados: DadosPaciente): Promise<string[]> {
  try {
    await Paciente.create(dados);
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return Object.keys(err.errors);
    }
    throw err;
  }
  return [];
}

beforeAll(async () => {
  await conectarBancoDeTeste('models_paciente');
  await Paciente.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('model Paciente', () => {
  it('grava paciente com telefone de 11 e de 10 dígitos', async () => {
    await Paciente.create({ _id: 'PAC0050', nome: 'Daniel Moura', telefone: '53948954499' });
    await Paciente.create({ _id: 'PAC0051', nome: 'Ana Lima', telefone: '5332221111' });

    expect(await Paciente.findById('PAC0050').lean()).toMatchObject({
      _id: 'PAC0050',
      nome: 'Daniel Moura',
      telefone: '53948954499',
    });
    expect(await Paciente.findById('PAC0051').lean()).toMatchObject({ telefone: '5332221111' });
  });

  it('grava paciente sem telefone', async () => {
    await Paciente.create({ _id: 'PAC0050', nome: 'Daniel Moura', telefone: null });

    const salvo = await Paciente.findById('PAC0050').lean();
    expect(salvo?.telefone).toBeNull();
  });

  it('recusa telefone com 9 ou 12 dígitos', async () => {
    const base = { _id: 'PAC0050', nome: 'Daniel Moura' };
    expect(await camposRecusados({ ...base, telefone: '539489544' })).toContain('telefone');
    expect(await camposRecusados({ ...base, telefone: '553948954499' })).toContain('telefone');
  });

  it('recusa telefone com caracteres que não são dígitos', async () => {
    const base = { _id: 'PAC0050', nome: 'Daniel Moura' };
    expect(await camposRecusados({ ...base, telefone: '(53) 94895-4499' })).toContain('telefone');
    expect(await camposRecusados({ ...base, telefone: '5394895449a' })).toContain('telefone');
  });

  it('recusa nome vazio', async () => {
    expect(await camposRecusados({ _id: 'PAC0050', nome: '', telefone: null })).toContain('nome');
    expect(await Paciente.countDocuments()).toBe(0);
  });

  it('recusa _id repetido', async () => {
    await Paciente.create({ _id: 'PAC0050', nome: 'Daniel Moura', telefone: null });

    await expect(Paciente.create({ _id: 'PAC0050', nome: 'Outro Nome', telefone: null })).rejects.toMatchObject({
      code: 11000,
    });
    expect(await Paciente.countDocuments()).toBe(1);
  });
});

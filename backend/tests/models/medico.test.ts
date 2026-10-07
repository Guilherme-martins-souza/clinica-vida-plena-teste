import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Medico, type DadosMedico } from '../../src/models/medico';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

function medicoValido(): DadosMedico {
  return {
    _id: 'MED01',
    nome: 'Dra. Ana Souza',
    especialidade: 'Cardiologia',
    grade: [
      { dia: 'segunda', inicio: '07:00', fim: '12:00' },
      { dia: 'quarta', inicio: '13:30', fim: '18:00' },
    ],
  };
}

// Tenta gravar e devolve o caminho dos campos recusados pela validação.
async function camposRecusados(dados: DadosMedico): Promise<string[]> {
  try {
    await Medico.create(dados);
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return Object.keys(err.errors);
    }
    throw err;
  }
  return [];
}

beforeAll(async () => {
  await conectarBancoDeTeste('models_medico');
  await Medico.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('model Medico', () => {
  it('grava um médico válido com a grade', async () => {
    await Medico.create(medicoValido());

    const salvo = await Medico.findById('MED01').lean();
    expect(salvo).toMatchObject({
      _id: 'MED01',
      nome: 'Dra. Ana Souza',
      especialidade: 'Cardiologia',
      grade: [
        { dia: 'segunda', inicio: '07:00', fim: '12:00' },
        { dia: 'quarta', inicio: '13:30', fim: '18:00' },
      ],
    });
  });

  it('recusa dia da semana inválido', async () => {
    const dados = medicoValido();
    dados.grade[0] = { ...dados.grade[0], dia: 'feriado' as DadosMedico['grade'][number]['dia'] };

    expect(await camposRecusados(dados)).toContain('grade.0.dia');
  });

  it('recusa hora fora do formato HH:mm', async () => {
    const semZero = medicoValido();
    semZero.grade[0] = { ...semZero.grade[0], inicio: '7:00' };
    expect(await camposRecusados(semZero)).toContain('grade.0.inicio');

    const horaInexistente = medicoValido();
    horaInexistente.grade[0] = { ...horaInexistente.grade[0], fim: '24:00' };
    expect(await camposRecusados(horaInexistente)).toContain('grade.0.fim');
  });

  it('recusa início igual ou depois do fim', async () => {
    const igual = medicoValido();
    igual.grade[0] = { dia: 'segunda', inicio: '12:00', fim: '12:00' };
    expect(await camposRecusados(igual)).toContain('grade.0.fim');

    const depois = medicoValido();
    depois.grade[0] = { dia: 'segunda', inicio: '13:00', fim: '12:00' };
    expect(await camposRecusados(depois)).toContain('grade.0.fim');
  });

  it('recusa campo obrigatório vazio', async () => {
    expect(await camposRecusados({ ...medicoValido(), nome: '' })).toContain('nome');
    expect(await camposRecusados({ ...medicoValido(), especialidade: '' })).toContain('especialidade');
    expect(await camposRecusados({ ...medicoValido(), _id: '' })).toContain('_id');
    expect(await Medico.countDocuments()).toBe(0);
  });

  it('recusa _id repetido', async () => {
    await Medico.create(medicoValido());

    await expect(Medico.create({ ...medicoValido(), nome: 'Outro' })).rejects.toMatchObject({
      code: 11000,
    });
    expect(await Medico.countDocuments()).toBe(1);
  });
});

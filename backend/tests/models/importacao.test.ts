import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Importacao, type DadosImportacao } from '../../src/models/importacao';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

function importacaoConcluida(): DadosImportacao {
  return {
    origem: 'automatica',
    situacao: 'concluida',
    iniciadaEm: new Date('2026-10-07T12:00:00Z'),
    finalizadaEm: new Date('2026-10-07T12:00:05Z'),
    erro: null,
    dataReferencia: new Date('2025-11-20T13:30:00Z'),
    totais: {
      lidas: 3,
      importadas: 1,
      corrigidas: 1,
      descartadas: 2,
      medicos: 1,
      pacientes: 1,
    },
    descartesPorMotivo: { duplicada: 1, fora_da_grade: 1 },
    correcoesPorTipo: { data_formato: 1 },
    descartes: [
      {
        linha: 3,
        codigo: 'AG00002',
        motivo: 'duplicada',
        valores: {
          id: 'AG00002',
          paciente_id: 'PAC0050',
          paciente_nome: 'Daniel, "Dani" Moura',
          paciente_telefone: '',
          tipo_atendimento: 'convenio',
          medico_id: 'MED01',
          data_agendamento: '12/08/2025 12:48',
          data_consulta: '2025-09-26 10:00',
          status: 'falta',
        },
      },
    ],
    arquivos: {
      json: '/data/relatorios/importacao-20261007-090000.json',
      csv: '/data/relatorios/importacao-20261007-090000-descartes.csv',
    },
  };
}

function emAndamento(): DadosImportacao {
  return {
    origem: 'manual',
    situacao: 'em_andamento',
    iniciadaEm: new Date(),
    finalizadaEm: null,
    erro: null,
    dataReferencia: null,
    totais: null,
    descartesPorMotivo: {},
    correcoesPorTipo: {},
    descartes: [],
    arquivos: null,
  };
}

// Tenta gravar e devolve o caminho dos campos recusados pela validação.
async function camposRecusados(dados: DadosImportacao): Promise<string[]> {
  try {
    await Importacao.create(dados);
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return Object.keys(err.errors);
    }
    throw err;
  }
  return [];
}

beforeAll(async () => {
  await conectarBancoDeTeste('models_importacao');
  await Importacao.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('model Importacao', () => {
  it('grava uma importação concluída completa', async () => {
    const dados = importacaoConcluida();
    const criada = await Importacao.create(dados);

    const salva = await Importacao.findById(criada._id).lean();
    expect(salva).toMatchObject(dados);
  });

  it('recusa uma segunda importação em andamento ao mesmo tempo', async () => {
    await Importacao.create(emAndamento());

    await expect(Importacao.create(emAndamento())).rejects.toMatchObject({ code: 11000 });
    expect(await Importacao.countDocuments({ situacao: 'em_andamento' })).toBe(1);
  });

  it('deixa duas importações concluídas conviverem', async () => {
    await Importacao.create(importacaoConcluida());
    await Importacao.create(importacaoConcluida());

    expect(await Importacao.countDocuments({ situacao: 'concluida' })).toBe(2);
  });

  it('recusa origem fora da lista', async () => {
    const dados = {
      ...importacaoConcluida(),
      origem: 'agendada' as DadosImportacao['origem'],
    };
    expect(await camposRecusados(dados)).toContain('origem');
  });

  it('recusa situação fora da lista', async () => {
    const dados = {
      ...importacaoConcluida(),
      situacao: 'pausada' as DadosImportacao['situacao'],
    };
    expect(await camposRecusados(dados)).toContain('situacao');
    expect(await Importacao.countDocuments()).toBe(0);
  });
});

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { Importacao, type DadosImportacao } from '../../src/models/importacao';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const TOTAIS = { lidas: 3, importadas: 1, corrigidas: 1, descartadas: 2, medicos: 1, pacientes: 1 };

function concluida(iniciadaEm: string): DadosImportacao {
  return {
    origem: 'automatica',
    situacao: 'concluida',
    iniciadaEm: new Date(iniciadaEm),
    finalizadaEm: new Date(new Date(iniciadaEm).getTime() + 5000),
    erro: null,
    dataReferencia: new Date('2026-09-24T20:42:00Z'),
    totais: TOTAIS,
    descartesPorMotivo: { duplicada: 1, fora_da_grade: 1 },
    correcoesPorTipo: { data_formato: 1 },
    slotsDuplos: [],
    descartes: [
      {
        linha: 3,
        codigo: 'AG00001',
        motivo: 'duplicada',
        valores: {
          id: 'AG00001',
          paciente_id: 'PAC0001',
          paciente_nome: 'Maria Silva',
          paciente_telefone: '53948954499',
          tipo_atendimento: 'convenio',
          medico_id: 'MED01',
          data_agendamento: '2026-09-01 10:00',
          data_consulta: '2026-09-21 08:00',
          status: 'realizada',
        },
      },
      {
        linha: 5,
        codigo: 'AG00003',
        motivo: 'fora_da_grade',
        valores: {
          id: 'AG00003',
          paciente_id: 'PAC0001',
          paciente_nome: 'Silva, Maria',
          paciente_telefone: '53948954499',
          tipo_atendimento: 'convenio',
          medico_id: 'MED01',
          data_agendamento: '2026-09-02 10:00',
          data_consulta: '2026-09-29 08:00',
          status: 'agendada',
        },
      },
    ],
    arquivos: null,
  };
}

function falhou(iniciadaEm: string): DadosImportacao {
  return {
    ...concluida(iniciadaEm),
    origem: 'manual',
    situacao: 'falhou',
    erro: 'Não foi possível ler o arquivo /data/medicos.json',
    dataReferencia: null,
    totais: null,
    descartesPorMotivo: {},
    correcoesPorTipo: {},
    descartes: [],
  };
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_importacoes');
  await Importacao.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('GET /api/importacoes', () => {
  it('lista vazia responde []', async () => {
    const res = await request(app).get('/api/importacoes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lista da mais recente para a mais antiga, com id, origem, situação, início, fim e totais e sem descartes', async () => {
    const antiga = await Importacao.create(concluida('2026-10-01T12:00:00Z'));
    const recente = await Importacao.create(falhou('2026-10-07T12:00:00Z'));
    const meio = await Importacao.create(concluida('2026-10-03T12:00:00Z'));

    const res = await request(app).get('/api/importacoes');

    expect(res.status).toBe(200);
    expect(res.body.map((item: { id: string }) => item.id)).toEqual([
      String(recente._id),
      String(meio._id),
      String(antiga._id),
    ]);
    expect(res.body[2]).toMatchObject({
      id: String(antiga._id),
      origem: 'automatica',
      situacao: 'concluida',
      iniciadaEm: '2026-10-01T12:00:00.000Z',
      finalizadaEm: '2026-10-01T12:00:05.000Z',
      totais: TOTAIS,
    });
    for (const item of res.body) {
      expect(item).not.toHaveProperty('descartes');
    }
  });
});

describe('GET /api/importacoes/:id', () => {
  it('traz o relatório completo com os descartes', async () => {
    const importacao = await Importacao.create(concluida('2026-10-01T12:00:00Z'));

    const res = await request(app).get(`/api/importacoes/${importacao._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: String(importacao._id),
      situacao: 'concluida',
      dataReferencia: '2026-09-24T20:42:00.000Z',
      totais: TOTAIS,
      descartesPorMotivo: { duplicada: 1, fora_da_grade: 1 },
      correcoesPorTipo: { data_formato: 1 },
      slotsDuplos: [],
      erro: null,
    });
    expect(res.body.descartes).toEqual(concluida('2026-10-01T12:00:00Z').descartes);
  });

  it('numa importação que falhou traz a mensagem do erro', async () => {
    const importacao = await Importacao.create(falhou('2026-10-07T12:00:00Z'));

    const res = await request(app).get(`/api/importacoes/${importacao._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      situacao: 'falhou',
      erro: 'Não foi possível ler o arquivo /data/medicos.json',
      descartes: [],
    });
  });
});

describe('GET /api/importacoes/:id/descartes.csv', () => {
  it('responde o CSV das linhas descartadas para download, com o nome do arquivo', async () => {
    // 01/10/2026 09:00:00 em São Paulo
    const importacao = await Importacao.create(concluida('2026-10-01T12:00:00Z'));

    const res = await request(app).get(`/api/importacoes/${importacao._id}/descartes.csv`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="importacao-20261001-090000-descartes.csv"');
    expect(res.text.split('\n')).toEqual([
      'linha,motivo,id,paciente_id,paciente_nome,paciente_telefone,tipo_atendimento,medico_id,data_agendamento,data_consulta,status',
      '3,duplicada,AG00001,PAC0001,Maria Silva,53948954499,convenio,MED01,2026-09-01 10:00,2026-09-21 08:00,realizada',
      '5,fora_da_grade,AG00003,PAC0001,"Silva, Maria",53948954499,convenio,MED01,2026-09-02 10:00,2026-09-29 08:00,agendada',
      '',
    ]);
  });
});

describe('id inexistente ou inválido', () => {
  const INEXISTENTE = '6ac6ceae1bf7b5bb31afe761';

  for (const rota of ['', '/descartes.csv']) {
    for (const id of [INEXISTENTE, 'abc']) {
      it(`GET /api/importacoes/${id}${rota} responde 404 IMPORTACAO_NAO_ENCONTRADA`, async () => {
        await Importacao.create(concluida('2026-10-01T12:00:00Z'));

        const res = await request(app).get(`/api/importacoes/${id}${rota}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
          error: { code: 'IMPORTACAO_NAO_ENCONTRADA', message: 'Importação não encontrada' },
        });
      });
    }
  }
});

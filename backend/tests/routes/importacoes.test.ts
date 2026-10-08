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
  it('lista vazia responde página sem itens', async () => {
    const res = await request(app).get('/api/importacoes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  });

  it('lista paginada da mais recente para a mais antiga, com id, origem, situação, início, fim e totais e sem descartes', async () => {
    const antiga = await Importacao.create(concluida('2026-10-01T12:00:00Z'));
    const recente = await Importacao.create(falhou('2026-10-07T12:00:00Z'));
    const meio = await Importacao.create(concluida('2026-10-03T12:00:00Z'));

    const res = await request(app).get('/api/importacoes');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.pagina).toBe(1);
    expect(res.body.porPagina).toBe(10);
    expect(res.body.itens.map((item: { id: string }) => item.id)).toEqual([
      String(recente._id),
      String(meio._id),
      String(antiga._id),
    ]);
    expect(res.body.itens[2]).toMatchObject({
      id: String(antiga._id),
      origem: 'automatica',
      situacao: 'concluida',
      iniciadaEm: '2026-10-01T12:00:00.000Z',
      finalizadaEm: '2026-10-01T12:00:05.000Z',
      totais: TOTAIS,
    });
    for (const item of res.body.itens) {
      expect(item).not.toHaveProperty('descartes');
    }
  });

  it('pagina e porPagina escolhem o trecho, mantendo a mais recente primeiro', async () => {
    const antiga = await Importacao.create(concluida('2026-10-01T12:00:00Z'));
    await Importacao.create(falhou('2026-10-07T12:00:00Z'));
    await Importacao.create(concluida('2026-10-03T12:00:00Z'));

    const res = await request(app).get('/api/importacoes?pagina=2&porPagina=2');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.pagina).toBe(2);
    expect(res.body.porPagina).toBe(2);
    expect(res.body.itens.map((item: { id: string }) => item.id)).toEqual([String(antiga._id)]);
  });

  it('porPagina=101 responde 400 PAGINACAO_INVALIDA', async () => {
    const res = await request(app).get('/api/importacoes?porPagina=101');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAGINACAO_INVALIDA');
  });
});

describe('GET /api/importacoes/:id', () => {
  it('traz o relatório sem as linhas descartadas (elas vêm paginadas em /descartes)', async () => {
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
      erro: null,
    });
    expect(res.body).not.toHaveProperty('descartes');
  });

  it('numa importação que falhou traz a mensagem do erro', async () => {
    const importacao = await Importacao.create(falhou('2026-10-07T12:00:00Z'));

    const res = await request(app).get(`/api/importacoes/${importacao._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      situacao: 'falhou',
      erro: 'Não foi possível ler o arquivo /data/medicos.json',
    });
  });
});

// 25 descartes: linhas 2 a 26; as de linha par são "duplicada" (13), as ímpares "fora_da_grade" (12).
function comVinteECincoDescartes(): DadosImportacao {
  const modelo = concluida('2026-10-01T12:00:00Z');
  const descartes = Array.from({ length: 25 }, (_, i) => {
    const linha = i + 2;
    const codigo = `AG${String(linha).padStart(5, '0')}`;
    const motivo = linha % 2 === 0 ? ('duplicada' as const) : ('fora_da_grade' as const);
    return { linha, codigo, motivo, valores: { ...modelo.descartes[0].valores, id: codigo } };
  });
  return { ...modelo, descartes };
}

function linhasDe(res: request.Response): number[] {
  return res.body.itens.map((d: { linha: number }) => d.linha);
}

function intervalo(de: number, ate: number): number[] {
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}

describe('GET /api/importacoes/:id/descartes', () => {
  it('sem parâmetros devolve a primeira página de 10, na ordem do arquivo, com o total', async () => {
    const importacao = await Importacao.create(comVinteECincoDescartes());

    const res = await request(app).get(`/api/importacoes/${importacao._id}/descartes`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 25, pagina: 1, porPagina: 10 });
    expect(linhasDe(res)).toEqual(intervalo(2, 11));
    expect(res.body.itens[0]).toEqual(comVinteECincoDescartes().descartes[0]);
  });

  it('pagina e porPagina escolhem o trecho; a última página vem incompleta', async () => {
    const importacao = await Importacao.create(comVinteECincoDescartes());
    const url = `/api/importacoes/${importacao._id}/descartes`;

    const segunda = await request(app).get(url).query({ pagina: 2, porPagina: 10 });
    const terceira = await request(app).get(url).query({ pagina: 3, porPagina: 10 });
    const deTrinta = await request(app).get(url).query({ porPagina: 30 });

    expect(linhasDe(segunda)).toEqual(intervalo(12, 21));
    expect(linhasDe(terceira)).toEqual(intervalo(22, 26));
    expect(deTrinta.body).toMatchObject({ total: 25, pagina: 1, porPagina: 30 });
    expect(linhasDe(deTrinta)).toEqual(intervalo(2, 26));
  });

  it('página depois da última vem vazia, com o total', async () => {
    const importacao = await Importacao.create(comVinteECincoDescartes());

    const res = await request(app).get(`/api/importacoes/${importacao._id}/descartes`).query({ pagina: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ itens: [], total: 25, pagina: 4, porPagina: 10 });
  });

  it('motivo filtra antes de paginar e o total conta só esse motivo', async () => {
    const importacao = await Importacao.create(comVinteECincoDescartes());

    const res = await request(app)
      .get(`/api/importacoes/${importacao._id}/descartes`)
      .query({ motivo: 'fora_da_grade', pagina: 2, porPagina: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 12, pagina: 2, porPagina: 5 });
    expect(linhasDe(res)).toEqual([13, 15, 17, 19, 21]);
  });

  it('importação que falhou responde lista vazia', async () => {
    const importacao = await Importacao.create(falhou('2026-10-07T12:00:00Z'));

    const res = await request(app).get(`/api/importacoes/${importacao._id}/descartes`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  });

  for (const query of [{ pagina: 0 }, { pagina: 'abc' }, { porPagina: 0 }, { porPagina: 101 }, { pagina: 1.5 }]) {
    it(`responde 400 PAGINACAO_INVALIDA para ${JSON.stringify(query)}`, async () => {
      const importacao = await Importacao.create(comVinteECincoDescartes());

      const res = await request(app).get(`/api/importacoes/${importacao._id}/descartes`).query(query);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PAGINACAO_INVALIDA');
    });
  }

  it('responde 400 MOTIVO_INVALIDO para motivo fora da lista', async () => {
    const importacao = await Importacao.create(comVinteECincoDescartes());

    const res = await request(app).get(`/api/importacoes/${importacao._id}/descartes`).query({ motivo: 'talvez' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'MOTIVO_INVALIDO', message: 'Motivo de descarte desconhecido' } });
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

  for (const rota of ['', '/descartes', '/descartes.csv']) {
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

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { Medico } from '../../src/models/medico';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// 12 médicos gravados fora de ordem: MED12 tem o nome "Médico 01", MED11 "Médico 02"... MED01 "Médico 12".
const MEDICOS = Array.from({ length: 12 }, (_, indice) => {
  const numero = String(indice + 1).padStart(2, '0');
  const posicaoNoNome = String(12 - indice).padStart(2, '0');
  return {
    _id: `MED${numero}`,
    nome: `Médico ${posicaoNoNome}`,
    especialidade: 'Clínica Geral',
    grade: [{ dia: 'segunda', inicio: '08:00', fim: '12:00' }],
  };
});

beforeAll(async () => {
  await conectarBancoDeTeste('routes_medicos');
  await Medico.init();
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create(MEDICOS);
  // Um médico que já recebeu consulta pela tela tem a trava versaoAgenda; ela não vai na resposta.
  await Medico.updateOne({ _id: 'MED12' }, { $inc: { versaoAgenda: 1 } });
});

afterAll(async () => {
  await desconectar();
});

describe('GET /api/medicos (MED-01)', () => {
  it('página 1 traz 10 médicos em ordem de nome, com código, nome, especialidade e grade, e o total', async () => {
    const res = await request(app).get('/api/medicos');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.pagina).toBe(1);
    expect(res.body.porPagina).toBe(10);
    expect(res.body.itens.map((medico: { nome: string }) => medico.nome)).toEqual([
      'Médico 01',
      'Médico 02',
      'Médico 03',
      'Médico 04',
      'Médico 05',
      'Médico 06',
      'Médico 07',
      'Médico 08',
      'Médico 09',
      'Médico 10',
    ]);
    expect(res.body.itens[0]).toEqual({
      id: 'MED12',
      nome: 'Médico 01',
      especialidade: 'Clínica Geral',
      grade: [{ dia: 'segunda', inicio: '08:00', fim: '12:00' }],
    });
  });

  it('?busca= filtra por trecho do nome, ignorando maiúsculas e acentos', async () => {
    const res = await request(app).get('/api/medicos?busca=medico 12');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.itens[0].nome).toBe('Médico 12');
  });

  it('página 2 traz os 2 restantes', async () => {
    const res = await request(app).get('/api/medicos?pagina=2');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.itens.map((medico: { id: string }) => medico.id)).toEqual(['MED02', 'MED01']);
  });

  it('porPagina=101 responde 400 PAGINACAO_INVALIDA', async () => {
    const res = await request(app).get('/api/medicos?porPagina=101');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAGINACAO_INVALIDA');
  });
});

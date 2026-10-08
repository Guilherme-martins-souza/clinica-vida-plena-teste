import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const HORA = 60 * 60 * 1000;

async function consulta(pacienteId: string, dataHora: string, status: StatusConsulta, canceladaHorasAntes?: number) {
  const inicio = new Date(`${dataHora}:00-03:00`);
  await Consulta.create({
    codigoLegado: null,
    pacienteId,
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio,
    marcadaEm: null,
    canceladaEm: canceladaHorasAntes === undefined ? null : new Date(inicio.getTime() - canceladaHorasAntes * HORA),
    status,
  });
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_pacientes');
  await Promise.all([Paciente.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Paciente.create([
    { _id: 'PAC0003', nome: 'Maria Silva', telefone: '53948954499' },
    { _id: 'PAC0001', nome: 'João Pereira', telefone: '11987654321' },
    { _id: 'PAC0002', nome: 'Ana Conceição', telefone: null },
  ]);

  // João: realizada, falta, cancelamento 23 h antes (falta) e 48 h antes (fora) → 3 concluídas, 2 faltas.
  await consulta('PAC0001', '2026-01-05T08:00', 'realizada');
  await consulta('PAC0001', '2026-01-06T08:00', 'falta');
  await consulta('PAC0001', '2026-01-07T08:00', 'cancelada_paciente', 23);
  await consulta('PAC0001', '2026-01-08T08:00', 'cancelada_paciente', 48);
  await consulta('PAC0001', '2099-01-05T08:00', 'agendada');
  // Maria: só cancelamento da clínica → 0 concluídas.
  await consulta('PAC0003', '2026-01-05T09:00', 'cancelada_clinica', 1);
});

afterAll(async () => {
  await desconectar();
});

describe('GET /api/pacientes (PAC-01)', () => {
  it('lista paginada por nome, com código, nome, telefone, concluídas e faltas do histórico', async () => {
    const res = await request(app).get('/api/pacientes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      itens: [
        { id: 'PAC0002', nome: 'Ana Conceição', telefone: null, concluidas: 0, faltas: 0 },
        { id: 'PAC0001', nome: 'João Pereira', telefone: '11987654321', concluidas: 3, faltas: 2 },
        { id: 'PAC0003', nome: 'Maria Silva', telefone: '53948954499', concluidas: 0, faltas: 0 },
      ],
      total: 3,
      pagina: 1,
      porPagina: 10,
    });
  });

  it('busca por trecho do nome sem diferenciar maiúsculas e acentos', async () => {
    const res = await request(app).get('/api/pacientes?busca=JOAO');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.itens.map((paciente: { id: string }) => paciente.id)).toEqual(['PAC0001']);

    const conceicao = await request(app).get('/api/pacientes?busca=conceicao');
    expect(conceicao.body.itens.map((paciente: { id: string }) => paciente.id)).toEqual(['PAC0002']);
  });

  it('pagina o resultado', async () => {
    const res = await request(app).get('/api/pacientes?pagina=2&porPagina=2');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.pagina).toBe(2);
    expect(res.body.porPagina).toBe(2);
    expect(res.body.itens.map((paciente: { id: string }) => paciente.id)).toEqual(['PAC0003']);
  });

  it('busca sem resultado devolve itens vazio e total 0', async () => {
    const res = await request(app).get('/api/pacientes?busca=ninguem');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  });

  it('busca repetida na query responde 400 FILTRO_INVALIDO', async () => {
    const res = await request(app).get('/api/pacientes?busca=joao&busca=maria');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILTRO_INVALIDO');
  });
});

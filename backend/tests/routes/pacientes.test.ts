import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { calcularConsideradoFalta } from '../../src/consultas/considerado-falta';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const HORA = 60 * 60 * 1000;

// `consideradoFalta` é gravado por quem escreve a consulta; aqui segue a mesma função, a não ser que o teste force.
async function consulta(
  pacienteId: string,
  dataHora: string,
  status: StatusConsulta,
  canceladaHorasAntes?: number,
  forcarConsideradoFalta?: boolean,
) {
  const inicio = new Date(`${dataHora}:00-03:00`);
  const canceladaEm =
    canceladaHorasAntes === undefined ? null : new Date(inicio.getTime() - canceladaHorasAntes * HORA);
  await Consulta.create({
    codigoLegado: null,
    pacienteId,
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio,
    marcadaEm: null,
    canceladaEm,
    status,
    consideradoFalta: forcarConsideradoFalta ?? calcularConsideradoFalta(status, inicio, canceladaEm),
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
        {
          id: 'PAC0002',
          nome: 'Ana Conceição',
          telefone: null,
          concluidas: 0,
          faltas: 0,
          primeiraConsulta: true,
          faltoso: false,
        },
        {
          id: 'PAC0001',
          nome: 'João Pereira',
          telefone: '11987654321',
          concluidas: 3,
          faltas: 2,
          primeiraConsulta: false,
          faltoso: true,
        },
        {
          id: 'PAC0003',
          nome: 'Maria Silva',
          telefone: '53948954499',
          concluidas: 0,
          faltas: 0,
          primeiraConsulta: true,
          faltoso: false,
        },
      ],
      total: 3,
      pagina: 1,
      porPagina: 10,
    });
  });

  it('cancelamento tardio gravado com consideradoFalta = true aparece como falta (CAMPO-01 AC 6)', async () => {
    await consulta('PAC0002', '2026-02-02T08:00', 'cancelada_paciente', 2, true);
    await consulta('PAC0002', '2026-02-03T08:00', 'cancelada_paciente', 2, false);

    const res = await request(app).get('/api/pacientes?busca=Ana');

    expect(res.body.itens[0]).toMatchObject({ id: 'PAC0002', concluidas: 1, faltas: 1 });
  });

  it('faltoso é true com 25% ou mais de faltas nos 5 últimos atendimentos, false sem atendimento ou abaixo disso (FALT-01)', async () => {
    // Ana: 1 falta em 5 atendimentos (20%) → não é faltoso. Com mais uma falta, os 5 últimos têm 2 faltas (40%) → é.
    await consulta('PAC0002', '2026-02-02T08:00', 'falta');
    for (const dia of ['01', '03', '04', '05']) {
      await consulta('PAC0002', `2026-02-${dia}T08:00`, 'realizada');
    }
    const antes = await request(app).get('/api/pacientes?busca=Ana');
    expect(antes.body.itens[0]).toMatchObject({ concluidas: 5, faltas: 1, faltoso: false });

    await consulta('PAC0002', '2026-02-06T08:00', 'falta');
    const depois = await request(app).get('/api/pacientes?busca=Ana');
    expect(depois.body.itens[0]).toMatchObject({ concluidas: 6, faltas: 2, faltoso: true });

    // Maria só teve cancelamento da clínica: sem atendimento, não é faltoso.
    const maria = await request(app).get('/api/pacientes?busca=Maria');
    expect(maria.body.itens[0]).toMatchObject({ concluidas: 0, faltoso: false });
  });

  it('primeiraConsulta é true só para quem não tem consulta não cancelada (só canceladas contam como nenhuma)', async () => {
    const res = await request(app).get('/api/pacientes');

    const primeira = Object.fromEntries(
      res.body.itens.map((paciente: { id: string; primeiraConsulta: boolean }) => [
        paciente.id,
        paciente.primeiraConsulta,
      ]),
    );
    // Ana: nenhuma consulta. Maria: só cancelada pela clínica. João: tem realizada, falta e agendada.
    expect(primeira).toEqual({ PAC0002: true, PAC0003: true, PAC0001: false });
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

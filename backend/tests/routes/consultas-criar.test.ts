import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { Consulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// A rota usa o relógio real: 05/01/2099 (segunda) está sempre no futuro e 06/01/2020 (segunda), no passado.
const FUTURO = '2099-01-05T09:00:00-03:00';

function corpo(campos: Record<string, unknown> = {}): Record<string, unknown> {
  return { pacienteId: 'PAC0001', medicoId: 'MED01', tipoAtendimento: 'particular', inicio: FUTURO, ...campos };
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_consultas_criar');
  await Promise.all([Medico.init(), Paciente.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create({
    _id: 'MED01',
    nome: 'Dr. Paulo Mendes',
    especialidade: 'Cardiologia',
    grade: [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }],
  });
  await Paciente.create([
    { _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' },
    { _id: 'PAC0002', nome: 'João Souza', telefone: null },
  ]);
});

afterAll(async () => {
  await desconectar();
});

describe('POST /api/consultas', () => {
  it('responde 201 com a consulta criada', async () => {
    const res = await request(app).post('/api/consultas').send(corpo());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      pacienteId: 'PAC0001',
      medicoId: 'MED01',
      tipoAtendimento: 'particular',
      inicio: new Date(FUTURO).toISOString(),
      status: 'agendada',
      codigoLegado: null,
      canceladaEm: null,
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.marcadaEm).toBe('string');
    expect(await Consulta.countDocuments({ _id: res.body.id })).toBe(1);
  });

  it.each([
    ['sem pacienteId', { pacienteId: undefined }],
    ['sem medicoId', { medicoId: undefined }],
    ['sem tipoAtendimento', { tipoAtendimento: undefined }],
    ['sem inicio', { inicio: undefined }],
    ['tipo inválido', { tipoAtendimento: 'sus' }],
    ['data inválida', { inicio: '2099-02-30T09:00:00-03:00' }],
    ['data que não é data', { inicio: 'amanhã' }],
    ['data sem fuso', { inicio: '2099-01-05T09:00:00' }],
  ])('%s → 400 DADOS_INVALIDOS', async (_caso, campos) => {
    const res = await request(app).post('/api/consultas').send(corpo(campos));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DADOS_INVALIDOS');
    expect(typeof res.body.error.message).toBe('string');
    expect(await Consulta.countDocuments()).toBe(0);
  });

  it('médico inexistente → 404 MEDICO_NAO_ENCONTRADO', async () => {
    const res = await request(app)
      .post('/api/consultas')
      .send(corpo({ medicoId: 'MED99' }));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'MEDICO_NAO_ENCONTRADO', message: expect.any(String) } });
  });

  it('paciente inexistente → 404 PACIENTE_NAO_ENCONTRADO', async () => {
    const res = await request(app)
      .post('/api/consultas')
      .send(corpo({ pacienteId: 'PAC9999' }));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'PACIENTE_NAO_ENCONTRADO', message: expect.any(String) } });
  });

  it('fora do slot → 422 FORA_DO_SLOT', async () => {
    const res = await request(app)
      .post('/api/consultas')
      .send(corpo({ inicio: '2099-01-05T09:10:00-03:00' }));

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: { code: 'FORA_DO_SLOT', message: expect.any(String) } });
  });

  it('fora da grade → 422 FORA_DA_GRADE', async () => {
    const res = await request(app)
      .post('/api/consultas')
      .send(corpo({ inicio: '2099-01-06T09:00:00-03:00' }));

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: { code: 'FORA_DA_GRADE', message: expect.any(String) } });
  });

  it('horário no passado → 422 HORARIO_PASSADO', async () => {
    const res = await request(app)
      .post('/api/consultas')
      .send(corpo({ inicio: '2020-01-06T09:00:00-03:00' }));

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: { code: 'HORARIO_PASSADO', message: expect.any(String) } });
  });

  it('horário ocupado → 409 HORARIO_OCUPADO com a mensagem', async () => {
    await request(app).post('/api/consultas').send(corpo()).expect(201);

    const res = await request(app)
      .post('/api/consultas')
      .send(corpo({ pacienteId: 'PAC0002' }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'HORARIO_OCUPADO', message: 'Dr. Paulo Mendes já tem consulta às 09:00 neste dia.' },
    });
  });
});

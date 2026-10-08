import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// A rota usa o relógio real: 2099 está sempre no futuro e 2020, no passado.
const FUTURO = new Date('2099-01-05T09:00:00-03:00');
const PASSADO = new Date('2020-01-06T09:00:00-03:00');

async function consultaCom(status: StatusConsulta, inicio: Date): Promise<string> {
  const consulta = await Consulta.create({
    codigoLegado: 'AG00001',
    pacienteId: 'PAC0001',
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio,
    marcadaEm: new Date('2019-12-01T10:00:00-03:00'),
    canceladaEm: null,
    status,
    consideradoFalta: false,
  });
  return String(consulta._id);
}

function patch(id: string, corpo: Record<string, unknown>) {
  return request(app).patch(`/api/consultas/${id}/status`).send(corpo);
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_consultas_status');
  await Consulta.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('PATCH /api/consultas/:id/status', () => {
  it.each<[StatusConsulta, StatusConsulta, Date]>([
    ['agendada', 'confirmada', FUTURO],
    ['agendada', 'realizada', PASSADO],
    ['agendada', 'falta', PASSADO],
    ['confirmada', 'realizada', PASSADO],
    ['confirmada', 'falta', PASSADO],
  ])('%s → %s responde 200 com o novo status, sem canceladaEm (AC 1)', async (atual, novo, inicio) => {
    const id = await consultaCom(atual, inicio);

    const res = await patch(id, { status: novo });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: novo, canceladaEm: null, codigoLegado: 'AG00001' });
    expect((await Consulta.findById(id).lean())?.status).toBe(novo);
  });

  it.each<[StatusConsulta, StatusConsulta]>([
    ['agendada', 'cancelada_paciente'],
    ['agendada', 'cancelada_clinica'],
    ['confirmada', 'cancelada_paciente'],
    ['confirmada', 'cancelada_clinica'],
  ])('%s → %s responde 200 e grava canceladaEm (AC 1 e 6)', async (atual, novo) => {
    const id = await consultaCom(atual, FUTURO);
    const antes = Date.now();

    const res = await patch(id, { status: novo });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(novo);
    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.status).toBe(novo);
    expect(gravada?.canceladaEm?.getTime()).toBeGreaterThanOrEqual(antes);
    expect(gravada?.canceladaEm?.getTime()).toBeLessThanOrEqual(Date.now());
    expect(res.body.canceladaEm).toBe(gravada?.canceladaEm?.toISOString());
  });

  it('a resposta traz consideradoFalta: true na falta (CAMPO-01 AC 8)', async () => {
    const res = await patch(await consultaCom('agendada', PASSADO), { status: 'falta' });

    expect(res.body.consideradoFalta).toBe(true);
  });

  it('a resposta traz consideradoFalta: false na confirmação (CAMPO-01 AC 8)', async () => {
    const res = await patch(await consultaCom('agendada', FUTURO), { status: 'confirmada' });

    expect(res.body.consideradoFalta).toBe(false);
  });

  it('cancelamento do paciente a menos de 24 h responde com consideradoFalta: true (CAMPO-01 AC 3)', async () => {
    const proximo = new Date(Date.now() + 2 * 60 * 60 * 1000);
    proximo.setMinutes(0, 0, 0);
    const id = await consultaCom('agendada', proximo);

    const res = await patch(id, { status: 'cancelada_paciente' });

    expect(res.status).toBe(200);
    expect(res.body.consideradoFalta).toBe(true);
  });

  it.each<StatusConsulta>(['realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'])(
    'status final %s → 422 TRANSICAO_INVALIDA (AC 2)',
    async (final) => {
      const id = await consultaCom(final, PASSADO);

      const res = await patch(id, { status: 'confirmada' });

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        error: { code: 'TRANSICAO_INVALIDA', message: `Consulta com status final (${final}) não muda mais.` },
      });
      expect((await Consulta.findById(id).lean())?.status).toBe(final);
    },
  );

  it.each<[StatusConsulta, StatusConsulta]>([
    ['confirmada', 'agendada'],
    ['confirmada', 'confirmada'],
    ['agendada', 'agendada'],
  ])(
    'transição fora da tabela %s → %s → 422 TRANSICAO_INVALIDA dizendo de onde para onde (AC 3)',
    async (atual, novo) => {
      const id = await consultaCom(atual, FUTURO);

      const res = await patch(id, { status: novo });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('TRANSICAO_INVALIDA');
      expect(res.body.error.message).toBe(`Não é possível mudar de ${atual} para ${novo}.`);
    },
  );

  it.each<StatusConsulta>(['realizada', 'falta'])('%s antes do horário → 422 ANTES_DO_HORARIO (AC 4)', async (novo) => {
    const id = await consultaCom('agendada', FUTURO);

    const res = await patch(id, { status: novo });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: { code: 'ANTES_DO_HORARIO', message: expect.any(String) } });
    expect((await Consulta.findById(id).lean())?.status).toBe('agendada');
  });

  it.each<StatusConsulta>(['confirmada', 'cancelada_paciente', 'cancelada_clinica'])(
    '%s depois do horário → 422 DEPOIS_DO_HORARIO (AC 5)',
    async (novo) => {
      const id = await consultaCom('agendada', PASSADO);

      const res = await patch(id, { status: novo });

      expect(res.status).toBe(422);
      expect(res.body).toEqual({ error: { code: 'DEPOIS_DO_HORARIO', message: expect.any(String) } });
      const gravada = await Consulta.findById(id).lean();
      expect(gravada?.status).toBe('agendada');
      expect(gravada?.canceladaEm).toBeNull();
    },
  );

  it('id inexistente → 404 CONSULTA_NAO_ENCONTRADA (AC 7)', async () => {
    const res = await patch('64b000000000000000000000', { status: 'confirmada' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'CONSULTA_NAO_ENCONTRADA', message: expect.any(String) } });
  });

  it('id inválido → 404 CONSULTA_NAO_ENCONTRADA (AC 7)', async () => {
    const res = await patch('nao-e-um-id', { status: 'confirmada' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONSULTA_NAO_ENCONTRADA');
  });

  it.each([
    ['status desconhecido', { status: 'remarcada' }],
    ['sem status', {}],
  ])('%s → 400 DADOS_INVALIDOS (AC 9)', async (_caso, corpo) => {
    const id = await consultaCom('agendada', FUTURO);

    const res = await patch(id, corpo);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'DADOS_INVALIDOS', message: expect.any(String) } });
    expect((await Consulta.findById(id).lean())?.status).toBe('agendada');
  });
});

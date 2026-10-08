import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// A rota usa o relógio real: 05/01/2099 (segunda) está sempre no futuro e 06/01/2020 (segunda), no passado.
function emSaoPaulo(dataHora: string): string {
  return new Date(`${dataHora}:00-03:00`).toISOString();
}

async function consulta(dataHora: string, status: StatusConsulta, pacienteId = 'PAC0001') {
  await Consulta.create({
    codigoLegado: null,
    pacienteId,
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio: new Date(`${dataHora}:00-03:00`),
    marcadaEm: null,
    canceladaEm: null,
    status,
  });
}

function horarios(medicoId: string, query: string) {
  return request(app).get(`/api/medicos/${medicoId}/horarios?${query}`);
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_medicos_horarios');
  await Promise.all([Medico.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create([
    {
      _id: 'MED01',
      nome: 'Dr. Paulo Mendes',
      especialidade: 'Cardiologia',
      grade: [{ dia: 'segunda', inicio: '08:00', fim: '09:00' }],
    },
    { _id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia', grade: [] },
  ]);
});

afterAll(async () => {
  await desconectar();
});

describe('GET /api/medicos/:id/horarios (AC 5)', () => {
  it('slot com consulta é ocupado; com consulta cancelada, livre', async () => {
    await consulta('2099-01-05T08:00', 'agendada');
    await consulta('2099-01-05T08:30', 'cancelada_paciente');

    const res = await horarios('MED01', 'data=2099-01-05');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: '2099-01-05',
      slots: [
        { inicio: emSaoPaulo('2099-01-05T08:00'), situacao: 'ocupado' },
        { inicio: emSaoPaulo('2099-01-05T08:30'), situacao: 'livre' },
      ],
      proximoDiaComVaga: null,
    });
  });

  it('slots que já começaram são passado', async () => {
    const res = await horarios('MED01', 'data=2020-01-06');

    expect(res.status).toBe(200);
    expect(res.body.slots).toEqual([
      { inicio: emSaoPaulo('2020-01-06T08:00'), situacao: 'passado' },
      { inicio: emSaoPaulo('2020-01-06T08:30'), situacao: 'passado' },
    ]);
  });
});

describe('próximo dia com vaga (AC 6)', () => {
  it('dia sem slot livre → próximo dia com vaga, pulando os cheios', async () => {
    await consulta('2099-01-05T08:00', 'agendada');
    await consulta('2099-01-05T08:30', 'confirmada');
    await consulta('2099-01-12T08:00', 'agendada');
    await consulta('2099-01-12T08:30', 'agendada', 'PAC0002');

    const res = await horarios('MED01', 'data=2099-01-05');

    expect(res.body.slots.map((slot: { situacao: string }) => slot.situacao)).toEqual(['ocupado', 'ocupado']);
    expect(res.body.proximoDiaComVaga).toBe('2099-01-19');
  });

  it('dia sem grade → lista vazia e o próximo dia com vaga', async () => {
    const res = await horarios('MED01', 'data=2099-01-06');

    expect(res.body).toEqual({ data: '2099-01-06', slots: [], proximoDiaComVaga: '2099-01-12' });
  });

  it('sem vaga nos próximos 60 dias → null', async () => {
    const res = await horarios('MED02', 'data=2099-01-05');

    expect(res.body).toEqual({ data: '2099-01-05', slots: [], proximoDiaComVaga: null });
  });

  it('vaga só depois de 60 dias não conta', async () => {
    // 05/01/2099 + 60 dias = 06/03/2099. Enche todas as segundas até lá; 09/03/2099 (dia 63) fica livre.
    const segundas = ['01-05', '01-12', '01-19', '01-26', '02-02', '02-09', '02-16', '02-23', '03-02'];
    for (const dia of segundas) {
      await consulta(`2099-${dia}T08:00`, 'agendada');
      await consulta(`2099-${dia}T08:30`, 'agendada', 'PAC0002');
    }

    const res = await horarios('MED01', 'data=2099-01-05');

    expect(res.body.proximoDiaComVaga).toBeNull();
  });
});

describe('erros', () => {
  it.each([
    ['sem data', ''],
    ['data inválida', 'data=2099-02-30'],
    ['data em outro formato', 'data=05/01/2099'],
  ])('%s → 400 FILTRO_INVALIDO', async (_caso, query) => {
    const res = await horarios('MED01', query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'FILTRO_INVALIDO', message: expect.any(String) } });
  });

  it('médico inexistente → 404 MEDICO_NAO_ENCONTRADO', async () => {
    const res = await horarios('MED99', 'data=2099-01-05');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'MEDICO_NAO_ENCONTRADO', message: expect.any(String) } });
  });
});

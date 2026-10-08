import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// A rota usa o relógio real: 2099 está sempre no futuro e 2019/2020, no passado.
// Período do teste: 06/01/2020 (segunda) a 12/01/2020 (domingo), 7 dias.
// Período anterior: 30/12/2019 a 05/01/2020.
async function consulta(dataHora: string, status: StatusConsulta, pacienteId = 'PAC0001', medicoId = 'MED01') {
  await Consulta.create({
    codigoLegado: null,
    pacienteId,
    medicoId,
    tipoAtendimento: 'convenio',
    inicio: new Date(`${dataHora}:00-03:00`),
    marcadaEm: null,
    canceladaEm: null,
    status,
  });
}

function indicadores(query: string) {
  return request(app).get(`/api/indicadores?${query}`);
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_indicadores');
  await Promise.all([Medico.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create([
    { _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] },
    { _id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia', grade: [] },
  ]);

  // Período: primeiro e último dia entram; o dia seguinte não.
  await consulta('2020-01-06T08:00', 'falta', 'PAC0002'); // primeira consulta do PAC0002
  await consulta('2020-01-12T23:30', 'realizada'); // retorno do PAC0001 (domingo)
  await consulta('2020-01-07T08:00', 'agendada'); // sem resultado
  await consulta('2020-01-13T00:00', 'falta'); // dia seguinte: fora

  // Período anterior, de mesmo tamanho: 1 falta em 2 concluídas.
  await consulta('2020-01-05T23:30', 'falta');
  await consulta('2019-12-30T00:00', 'realizada');
  await consulta('2019-12-29T23:30', 'falta'); // antes do período anterior: fora

  // Próximas: contam sempre, independente do período.
  await consulta('2099-01-05T08:00', 'agendada');
  await consulta('2099-01-05T08:30', 'confirmada');
  await consulta('2099-01-05T09:00', 'cancelada_clinica');
});

afterAll(async () => {
  await desconectar();
});

describe('GET /api/indicadores (IND-01)', () => {
  it('conta as consultas do período, inclusive o último dia, e não as do dia seguinte', async () => {
    const res = await indicadores('de=2020-01-06&ate=2020-01-12');

    expect(res.status).toBe(200);
    expect(res.body.periodo).toEqual({ de: '2020-01-06', ate: '2020-01-12' });
    expect(res.body.totais).toEqual({
      realizadas: 1,
      faltas: 1,
      canceladasPaciente: 0,
      canceladasClinica: 0,
      proximas: 2,
      proximasSemConfirmacao: 1,
    });
  });

  it('compara com o período anterior de mesmo número de dias', async () => {
    const res = await indicadores('de=2020-01-06&ate=2020-01-12');

    expect(res.body.taxaFaltaPeriodoAnterior).toBe(50);
  });

  it('período anterior só com consulta agendada (sem concluídas) → taxaFaltaPeriodoAnterior null', async () => {
    // Período: 08/01/2020; anterior: 07/01/2020, que só tem a consulta agendada.
    const res = await indicadores('de=2020-01-08&ate=2020-01-08');

    expect(res.status).toBe(200);
    expect(res.body.taxaFaltaPeriodoAnterior).toBeNull();
  });

  it('traz todos os médicos, recortes e primeira consulta com os números do banco', async () => {
    const res = await indicadores('de=2020-01-06&ate=2020-01-12');

    expect(res.body.porMedico).toHaveLength(2);
    expect(res.body.porMedico).toEqual(
      expect.arrayContaining([
        { medico: { id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia' }, faltas: 1, concluidas: 2 },
        { medico: { id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia' }, faltas: 0, concluidas: 0 },
      ]),
    );
    expect(res.body.diaTurno[0]).toEqual({
      turno: 'Manhã',
      dias: [
        { faltas: 1, concluidas: 1 },
        { faltas: 0, concluidas: 0 },
        { faltas: 0, concluidas: 0 },
        { faltas: 0, concluidas: 0 },
        { faltas: 0, concluidas: 0 },
      ],
    });
    expect(res.body.porTipo).toEqual([
      { tipo: 'convenio', faltas: 1, concluidas: 2 },
      { tipo: 'particular', faltas: 0, concluidas: 0 },
    ]);
    expect(res.body.porPrimeiraConsulta).toEqual([
      { primeiraConsulta: true, faltas: 1, concluidas: 1 },
      { primeiraConsulta: false, faltas: 0, concluidas: 1 },
    ]);
  });

  for (const query of [
    'ate=2020-01-12',
    'de=2020-01-06',
    'de=2020-02-30&ate=2020-03-01',
    'de=2020-01-12&ate=2020-01-06',
  ]) {
    it(`responde 400 PERIODO_INVALIDO para "${query}"`, async () => {
      const res = await indicadores(query);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PERIODO_INVALIDO');
    });
  }
});

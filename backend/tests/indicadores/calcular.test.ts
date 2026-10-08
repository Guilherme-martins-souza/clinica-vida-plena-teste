import { describe, expect, it } from 'vitest';
import {
  calcularIndicadores,
  resultado,
  type ConsultaParaIndicador,
  type EntradaIndicadores,
} from '../../src/indicadores/calcular';
import type { DadosMedico } from '../../src/models/medico';

// 12/10/2026 é segunda-feira; 13 terça; 14 quarta; 15 quinta; 16 sexta; 17 sábado.
function emSaoPaulo(dataHora: string): Date {
  return new Date(`${dataHora}:00-03:00`);
}

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

function antes(inicio: Date, ms: number): Date {
  return new Date(inicio.getTime() - ms);
}

function consulta(
  id: string,
  dataHora: string,
  dados: Partial<Omit<ConsultaParaIndicador, 'id' | 'inicio'>> = {},
): ConsultaParaIndicador {
  return {
    id,
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio: emSaoPaulo(dataHora),
    marcadaEm: null,
    canceladaEm: null,
    status: 'realizada',
    ...dados,
  };
}

// Consulta marcada `dias` dias (mais `horas` horas) antes do início.
function marcada(dataHora: string, dias: number, horas = 0): Date {
  return antes(emSaoPaulo(dataHora), dias * DIA + horas * HORA);
}

const MEDICOS: DadosMedico[] = [
  { _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] },
  { _id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia', grade: [] },
  { _id: 'MED03', nome: 'Dr. Carlos Souza', especialidade: 'Ortopedia', grade: [] },
];

function entrada(dados: Partial<EntradaIndicadores>): EntradaIndicadores {
  return {
    periodo: { de: '2026-10-01', ate: '2026-10-31' },
    consultas: [],
    anteriores: [],
    medicos: MEDICOS,
    primeiras: new Set(),
    ...dados,
  };
}

// Conjunto montado à mão. Concluídas: a, b, c, d, e, f, g, h (faltas: a, d, h).
const CONSULTAS: ConsultaParaIndicador[] = [
  consulta('a', '2026-10-12T11:30', { status: 'falta', marcadaEm: marcada('2026-10-12T11:30', 7) }),
  consulta('b', '2026-10-12T12:00', { tipoAtendimento: 'particular', marcadaEm: marcada('2026-10-12T12:00', 8) }),
  consulta('c', '2026-10-13T08:00', { medicoId: 'MED02', marcadaEm: marcada('2026-10-13T08:00', 14, 23) }),
  consulta('d', '2026-10-16T15:00', {
    medicoId: 'MED02',
    tipoAtendimento: 'particular',
    status: 'falta',
    marcadaEm: marcada('2026-10-16T15:00', 15),
  }),
  consulta('e', '2026-10-14T09:00', { marcadaEm: marcada('2026-10-14T09:00', 22) }),
  consulta('f', '2026-10-15T10:00', { marcadaEm: marcada('2026-10-15T10:00', 21, 23) }),
  consulta('g', '2026-10-12T08:00', { medicoId: 'MED02', tipoAtendimento: 'particular' }),
  consulta('h', '2026-10-17T09:00', { status: 'falta' }), // sábado: fora de dia × turno
  consulta('i', '2026-10-12T09:00', { status: 'agendada' }),
  consulta('l', '2026-10-15T09:00', { status: 'confirmada' }),
  consulta('j', '2026-10-13T09:00', { medicoId: 'MED02', status: 'cancelada_clinica' }),
  consulta('k', '2026-10-14T10:00', { status: 'cancelada_paciente' }), // histórico: sem canceladaEm
];

describe('calcularIndicadores com um conjunto conhecido (AC 1, 3, 9)', () => {
  const indicadores = calcularIndicadores(entrada({ consultas: CONSULTAS, primeiras: new Set(['a', 'c']) }));

  it('devolve o período pedido', () => {
    expect(indicadores.periodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  it('totais', () => {
    expect(indicadores.totais).toEqual({
      realizadas: 5,
      faltas: 3,
      canceladasPaciente: 1,
      canceladasClinica: 1,
      agendadas: 1,
      confirmadas: 1,
    });
  });

  it('por médico, incluindo o médico sem consulta com zero', () => {
    expect(indicadores.porMedico).toEqual([
      { medico: { id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia' }, faltas: 2, concluidas: 5 },
      { medico: { id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia' }, faltas: 1, concluidas: 3 },
      { medico: { id: 'MED03', nome: 'Dr. Carlos Souza', especialidade: 'Ortopedia' }, faltas: 0, concluidas: 0 },
    ]);
  });

  it('dia × turno de segunda a sexta: 11:30 é manhã e 12:00 é tarde', () => {
    expect(indicadores.diaTurno).toEqual([
      {
        turno: 'Manhã',
        dias: [
          { faltas: 1, concluidas: 2 },
          { faltas: 0, concluidas: 1 },
          { faltas: 0, concluidas: 1 },
          { faltas: 0, concluidas: 1 },
          { faltas: 0, concluidas: 0 },
        ],
      },
      {
        turno: 'Tarde',
        dias: [
          { faltas: 0, concluidas: 1 },
          { faltas: 0, concluidas: 0 },
          { faltas: 0, concluidas: 0 },
          { faltas: 0, concluidas: 0 },
          { faltas: 1, concluidas: 1 },
        ],
      },
    ]);
  });

  it('por tipo de atendimento', () => {
    expect(indicadores.porTipo).toEqual([
      { tipo: 'convenio', faltas: 2, concluidas: 5 },
      { tipo: 'particular', faltas: 1, concluidas: 3 },
    ]);
  });

  it('primeira consulta x retorno', () => {
    expect(indicadores.porPrimeiraConsulta).toEqual([
      { primeiraConsulta: true, faltas: 1, concluidas: 2 },
      { primeiraConsulta: false, faltas: 2, concluidas: 6 },
    ]);
  });

  it('faixas de antecedência: 7 dias é "Até 7", 8 é "8 a 14"; sem data de marcação fica fora', () => {
    expect(indicadores.porAntecedencia).toEqual([
      { faixa: 'Até 7 dias', faltas: 1, concluidas: 1 },
      { faixa: '8 a 14 dias', faltas: 0, concluidas: 2 },
      { faixa: '15 a 21 dias', faltas: 1, concluidas: 2 },
      { faixa: '22 dias ou mais', faltas: 0, concluidas: 1 },
    ]);
  });
});

describe('cancelamentos (AC 2, D23)', () => {
  const inicio = '2026-10-12T10:00';

  it('cancelada_paciente a menos de 24 h do início conta como falta', () => {
    const tardio = consulta('x', inicio, { status: 'cancelada_paciente', canceladaEm: marcada(inicio, 0, 23) });
    expect(resultado(tardio)).toBe('falta');

    const indicadores = calcularIndicadores(entrada({ consultas: [tardio] }));
    expect(indicadores.totais.faltas).toBe(1);
    expect(indicadores.totais.canceladasPaciente).toBe(0);
    expect(indicadores.porMedico[0]).toMatchObject({ faltas: 1, concluidas: 1 });
  });

  it('cancelada_paciente com 24 h de antecedência é cancelamento', () => {
    const comAntecedencia = consulta('x', inicio, { status: 'cancelada_paciente', canceladaEm: marcada(inicio, 1) });
    expect(resultado(comAntecedencia)).toBe('cancelada_paciente');

    const indicadores = calcularIndicadores(entrada({ consultas: [comAntecedencia] }));
    expect(indicadores.totais.faltas).toBe(0);
    expect(indicadores.totais.canceladasPaciente).toBe(1);
    expect(indicadores.porMedico[0]).toMatchObject({ faltas: 0, concluidas: 0 });
  });

  it('cancelada_clinica 1 h antes continua cancelamento da clínica', () => {
    const clinica = consulta('x', inicio, { status: 'cancelada_clinica', canceladaEm: marcada(inicio, 0, 1) });
    expect(resultado(clinica)).toBe('cancelada_clinica');

    const indicadores = calcularIndicadores(entrada({ consultas: [clinica] }));
    expect(indicadores.totais.faltas).toBe(0);
    expect(indicadores.totais.canceladasClinica).toBe(1);
  });

  it('agendada e confirmada não têm resultado', () => {
    expect(resultado(consulta('x', inicio, { status: 'agendada' }))).toBeNull();
    expect(resultado(consulta('x', inicio, { status: 'confirmada' }))).toBeNull();
  });
});

describe('taxa do período anterior (AC 4)', () => {
  it('sem consulta concluída no período anterior é null', () => {
    const anteriores = [
      consulta('p', '2026-09-14T08:00', { status: 'agendada' }),
      consulta('q', '2026-09-14T09:00', { status: 'cancelada_paciente' }),
    ];
    expect(calcularIndicadores(entrada({ anteriores })).taxaFaltaPeriodoAnterior).toBeNull();
    expect(calcularIndicadores(entrada({ anteriores: [] })).taxaFaltaPeriodoAnterior).toBeNull();
  });

  it('é a porcentagem de faltas sobre as concluídas do período anterior', () => {
    const anteriores = [
      consulta('p', '2026-09-14T08:00', { status: 'falta' }),
      consulta('q', '2026-09-14T09:00'),
      consulta('r', '2026-09-14T10:00'),
      consulta('s', '2026-09-14T11:00'),
    ];
    expect(calcularIndicadores(entrada({ anteriores })).taxaFaltaPeriodoAnterior).toBe(25);
  });
});

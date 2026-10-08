import { describe, expect, it } from 'vitest';
import { ehFinal, TRANSICOES, validarTransicao } from '../../src/consultas/transicoes';
import type { StatusConsulta } from '../../src/models/consulta';

const INICIO = new Date('2026-10-12T08:30:00-03:00');
const ANTES = new Date('2026-10-12T08:00:00-03:00');
const DEPOIS = new Date('2026-10-12T09:00:00-03:00');

const FINAIS: StatusConsulta[] = ['realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'];

describe('tabela de transições do enunciado', () => {
  it('agendada pode ir para confirmada, realizada, falta e os dois cancelamentos', () => {
    expect([...TRANSICOES.agendada].sort()).toEqual(
      ['cancelada_clinica', 'cancelada_paciente', 'confirmada', 'falta', 'realizada'].sort(),
    );
  });

  it('confirmada pode ir para realizada, falta e os dois cancelamentos', () => {
    expect([...TRANSICOES.confirmada].sort()).toEqual(
      ['cancelada_clinica', 'cancelada_paciente', 'falta', 'realizada'].sort(),
    );
  });

  it.each(FINAIS)('%s é final e não vai para nenhum status', (status) => {
    expect(TRANSICOES[status]).toEqual([]);
    expect(ehFinal(status)).toBe(true);
  });

  it('agendada e confirmada não são finais', () => {
    expect(ehFinal('agendada')).toBe(false);
    expect(ehFinal('confirmada')).toBe(false);
  });
});

describe('validarTransicao: transições permitidas no horário certo', () => {
  it.each([
    ['agendada', 'confirmada', ANTES],
    ['agendada', 'realizada', DEPOIS],
    ['agendada', 'falta', DEPOIS],
    ['agendada', 'cancelada_paciente', ANTES],
    ['agendada', 'cancelada_clinica', ANTES],
    ['confirmada', 'realizada', DEPOIS],
    ['confirmada', 'falta', DEPOIS],
    ['confirmada', 'cancelada_paciente', ANTES],
    ['confirmada', 'cancelada_clinica', ANTES],
  ] as const)('%s → %s é aceita', (atual, novo, agora) => {
    expect(validarTransicao(atual, novo, INICIO, agora)).toBeNull();
  });
});

describe('validarTransicao: transições inválidas', () => {
  it.each(FINAIS)('status final %s → TRANSICAO_INVALIDA com a mensagem do status final', (atual) => {
    expect(validarTransicao(atual, 'agendada', INICIO, ANTES)).toEqual({
      code: 'TRANSICAO_INVALIDA',
      message: `Consulta com status final (${atual}) não muda mais.`,
    });
  });

  it('confirmada → agendada → TRANSICAO_INVALIDA dizendo de onde para onde', () => {
    const erro = validarTransicao('confirmada', 'agendada', INICIO, ANTES);
    expect(erro?.code).toBe('TRANSICAO_INVALIDA');
    expect(erro?.message).toContain('confirmada');
    expect(erro?.message).toContain('agendada');
  });

  it('confirmada → confirmada → TRANSICAO_INVALIDA', () => {
    const erro = validarTransicao('confirmada', 'confirmada', INICIO, ANTES);
    expect(erro?.code).toBe('TRANSICAO_INVALIDA');
    expect(erro?.message).toContain('confirmada');
  });
});

describe('validarTransicao: regra de horário', () => {
  it.each(['realizada', 'falta'] as const)('%s antes do início → ANTES_DO_HORARIO', (novo) => {
    expect(validarTransicao('agendada', novo, INICIO, ANTES)?.code).toBe('ANTES_DO_HORARIO');
  });

  it.each(['realizada', 'falta'] as const)('%s no instante do início → aceita', (novo) => {
    expect(validarTransicao('agendada', novo, INICIO, INICIO)).toBeNull();
  });

  it.each(['confirmada', 'cancelada_paciente', 'cancelada_clinica'] as const)(
    '%s no instante do início → DEPOIS_DO_HORARIO',
    (novo) => {
      expect(validarTransicao('agendada', novo, INICIO, INICIO)?.code).toBe('DEPOIS_DO_HORARIO');
    },
  );

  it.each(['cancelada_paciente', 'cancelada_clinica'] as const)(
    'confirmada → %s depois do início → DEPOIS_DO_HORARIO',
    (novo) => {
      expect(validarTransicao('confirmada', novo, INICIO, DEPOIS)?.code).toBe('DEPOIS_DO_HORARIO');
    },
  );
});

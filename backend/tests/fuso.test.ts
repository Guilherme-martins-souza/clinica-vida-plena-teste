import { describe, expect, it } from 'vitest';
import { diaSeguinte, ehDataIso, inicioDoDia, OFFSET_SAO_PAULO, partesEmSaoPaulo } from '../src/fuso';

describe('fuso de São Paulo', () => {
  it('usa o deslocamento fixo de -03:00', () => {
    expect(OFFSET_SAO_PAULO).toBe('-03:00');
  });

  it('converte um instante para data, dia da semana e minutos do dia em São Paulo', () => {
    // 11:30 UTC = 08:30 em São Paulo, segunda-feira.
    expect(partesEmSaoPaulo(new Date('2026-10-12T11:30:00Z'))).toEqual({
      data: '2026-10-12',
      diaSemana: 'segunda',
      minutosDoDia: 510,
    });
  });

  it('usa o dia de São Paulo quando em UTC já é o dia seguinte', () => {
    // 02:00 UTC do dia 13 = 23:00 do dia 12 em São Paulo.
    expect(partesEmSaoPaulo(new Date('2026-10-13T02:00:00Z'))).toEqual({
      data: '2026-10-12',
      diaSemana: 'segunda',
      minutosDoDia: 23 * 60,
    });
  });

  it('inicioDoDia devolve a meia-noite de São Paulo como instante', () => {
    expect(inicioDoDia('2026-10-12').toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('diaSeguinte vira mês e ano', () => {
    expect(diaSeguinte('2026-12-31')).toBe('2027-01-01');
    expect(diaSeguinte('2026-02-28')).toBe('2026-03-01');
  });

  it('ehDataIso aceita só AAAA-MM-DD que existe no calendário', () => {
    expect(ehDataIso('2026-10-12')).toBe(true);
    expect(ehDataIso('2026-02-30')).toBe(false);
    expect(ehDataIso('12/10/2026')).toBe(false);
    expect(ehDataIso('2026-10-12T00:00')).toBe(false);
  });
});

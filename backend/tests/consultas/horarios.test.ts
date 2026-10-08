import { describe, expect, it } from 'vitest';
import { slotsDoDia } from '../../src/consultas/horarios';
import type { HorarioGrade } from '../../src/models/medico';

// 12/10/2026 é segunda-feira; 17/10/2026, sábado.
function emSaoPaulo(dataHora: string): Date {
  return new Date(`${dataHora}:00-03:00`);
}

const SEGUNDA_MANHA: HorarioGrade[] = [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }];

describe('slotsDoDia', () => {
  it('seg 07:00–12:00 numa segunda → 10 slots, de 07:00 a 11:30', () => {
    const slots = slotsDoDia(SEGUNDA_MANHA, '2026-10-12');

    expect(slots).toHaveLength(10);
    expect(slots).toEqual(
      ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((hora) =>
        emSaoPaulo(`2026-10-12T${hora}`),
      ),
    );
  });

  it('sábado sem grade → []', () => {
    expect(slotsDoDia(SEGUNDA_MANHA, '2026-10-17')).toEqual([]);
  });

  it('dois horários no dia → os dois blocos em ordem', () => {
    const grade: HorarioGrade[] = [
      { dia: 'segunda', inicio: '14:00', fim: '15:00' },
      { dia: 'terca', inicio: '08:00', fim: '09:00' },
      { dia: 'segunda', inicio: '08:00', fim: '09:00' },
    ];

    expect(slotsDoDia(grade, '2026-10-12')).toEqual(
      ['08:00', '08:30', '14:00', '14:30'].map((hora) => emSaoPaulo(`2026-10-12T${hora}`)),
    );
  });

  it('grade terminando fora de :00/:30 → último slot termina até o fim (edge case)', () => {
    const grade: HorarioGrade[] = [{ dia: 'segunda', inicio: '10:00', fim: '11:45' }];

    expect(slotsDoDia(grade, '2026-10-12')).toEqual(
      ['10:00', '10:30', '11:00'].map((hora) => emSaoPaulo(`2026-10-12T${hora}`)),
    );
  });
});

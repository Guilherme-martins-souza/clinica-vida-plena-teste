import { describe, expect, it } from 'vitest';
import {
  conflitoDeHorario,
  dentroDaGrade,
  DURACAO_SLOT_MINUTOS,
  ehAtiva,
  estaNoSlot,
} from '../../src/consultas/regras';
import type { StatusConsulta } from '../../src/models/consulta';
import type { HorarioGrade } from '../../src/models/medico';

// 12/10/2026 é segunda-feira; 13/10/2026, terça.
function emSaoPaulo(dataHora: string): Date {
  return new Date(`${dataHora}:00-03:00`);
}

const SEGUNDA_MANHA: HorarioGrade[] = [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }];

describe('estaNoSlot', () => {
  it('slot dura 30 minutos', () => {
    expect(DURACAO_SLOT_MINUTOS).toBe(30);
  });

  it('aceita minuto 00 e 30 sem segundos', () => {
    expect(estaNoSlot(emSaoPaulo('2026-10-12T08:00'))).toBe(true);
    expect(estaNoSlot(emSaoPaulo('2026-10-12T08:30'))).toBe(true);
  });

  it('recusa outro minuto ou segundos', () => {
    expect(estaNoSlot(emSaoPaulo('2026-10-12T08:15'))).toBe(false);
    expect(estaNoSlot(new Date('2026-10-12T08:00:01-03:00'))).toBe(false);
  });
});

describe('dentroDaGrade (segunda 07:00–12:00)', () => {
  it('07:00 está dentro (começa no início da grade)', () => {
    expect(dentroDaGrade(SEGUNDA_MANHA, emSaoPaulo('2026-10-12T07:00'))).toBe(true);
  });

  it('11:30 está dentro (termina às 12:00)', () => {
    expect(dentroDaGrade(SEGUNDA_MANHA, emSaoPaulo('2026-10-12T11:30'))).toBe(true);
  });

  it('12:00 está fora (terminaria depois do fim)', () => {
    expect(dentroDaGrade(SEGUNDA_MANHA, emSaoPaulo('2026-10-12T12:00'))).toBe(false);
  });

  it('06:30 está fora (antes do início)', () => {
    expect(dentroDaGrade(SEGUNDA_MANHA, emSaoPaulo('2026-10-12T06:30'))).toBe(false);
  });

  it('terça 08:00 está fora (sem grade no dia)', () => {
    expect(dentroDaGrade(SEGUNDA_MANHA, emSaoPaulo('2026-10-13T08:00'))).toBe(false);
  });

  it('grade que termina às 11:45: 11:00 dentro e 11:30 fora', () => {
    const grade: HorarioGrade[] = [{ dia: 'segunda', inicio: '07:00', fim: '11:45' }];
    expect(dentroDaGrade(grade, emSaoPaulo('2026-10-12T11:00'))).toBe(true);
    expect(dentroDaGrade(grade, emSaoPaulo('2026-10-12T11:30'))).toBe(false);
  });
});

describe('ehAtiva', () => {
  it('só cancelamentos não são ativos', () => {
    const ativos: StatusConsulta[] = ['agendada', 'confirmada', 'realizada', 'falta'];
    for (const status of ativos) {
      expect(ehAtiva(status)).toBe(true);
    }
    expect(ehAtiva('cancelada_paciente')).toBe(false);
    expect(ehAtiva('cancelada_clinica')).toBe(false);
  });
});

describe('conflitoDeHorario', () => {
  const inicio = emSaoPaulo('2026-10-12T08:00');
  const nova = { medicoId: 'MED01', pacienteId: 'PAC0001', inicio };

  it('mesmo médico e mesmo início → medico', () => {
    const existentes = [{ medicoId: 'MED01', pacienteId: 'PAC0002', inicio, status: 'agendada' as const }];
    expect(conflitoDeHorario(nova, existentes)).toBe('medico');
  });

  it('mesmo paciente e mesmo início com outro médico → paciente', () => {
    const existentes = [{ medicoId: 'MED02', pacienteId: 'PAC0001', inicio, status: 'confirmada' as const }];
    expect(conflitoDeHorario(nova, existentes)).toBe('paciente');
  });

  it('médico tem prioridade quando há conflito dos dois', () => {
    const existentes = [
      { medicoId: 'MED02', pacienteId: 'PAC0001', inicio, status: 'agendada' as const },
      { medicoId: 'MED01', pacienteId: 'PAC0002', inicio, status: 'agendada' as const },
    ];
    expect(conflitoDeHorario(nova, existentes)).toBe('medico');
  });

  it('só consulta cancelada no horário → null', () => {
    const existentes = [
      { medicoId: 'MED01', pacienteId: 'PAC0002', inicio, status: 'cancelada_paciente' as const },
      { medicoId: 'MED02', pacienteId: 'PAC0001', inicio, status: 'cancelada_clinica' as const },
    ];
    expect(conflitoDeHorario(nova, existentes)).toBeNull();
  });

  it('início diferente → null', () => {
    const existentes = [
      { medicoId: 'MED01', pacienteId: 'PAC0001', inicio: emSaoPaulo('2026-10-12T08:30'), status: 'agendada' as const },
    ];
    expect(conflitoDeHorario(nova, existentes)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { calcularRisco, classificar, type EntradaRisco } from '../../src/risco/calcular-risco';
import { CORTES, FATORES, PESOS } from '../../src/risco/pesos';

// Terça-feira 13/10/2026 10:00 em São Paulo, particular, confirmada, paciente já atendido sem faltas:
// nenhum fator soma. Cada teste muda só o que quer provar.
const AGORA = new Date('2026-10-01T10:00:00-03:00');
const base: EntradaRisco = {
  inicio: new Date('2026-10-13T10:00:00-03:00'),
  agora: AGORA,
  status: 'confirmada',
  tipoAtendimento: 'particular',
  primeiraConsulta: false,
  faltas: 0,
  atendimentos: 4,
};

function codigos(entrada: EntradaRisco): string[] {
  return calcularRisco(entrada).fatores.map((fator) => fator.codigo);
}

describe('calcularRisco: fatores (RISCO-01)', () => {
  it('sem nenhum fator soma 0 e o nível é baixo', () => {
    expect(calcularRisco(base)).toEqual({ pontos: 0, nivel: 'baixo', fatores: [] });
  });

  it('AC 1: 2 faltas somam o histórico', () => {
    expect(codigos({ ...base, faltas: 2, atendimentos: 10 })).toEqual(['historico']);
  });

  it('AC 1: 1 atendimento com 1 falta (100%) soma o histórico', () => {
    expect(codigos({ ...base, faltas: 1, atendimentos: 1 })).toEqual(['historico']);
  });

  it('AC 1: com 1 falta, taxa de 25% não soma e 33% soma (30% só se alcança com 3 faltas, que já somam pelo AC das 2 faltas)', () => {
    expect(codigos({ ...base, faltas: 1, atendimentos: 4 })).toEqual([]);
    expect(codigos({ ...base, faltas: 1, atendimentos: 3 })).toEqual(['historico']);
  });

  it('AC 1: 0 atendimentos não dá erro e não soma', () => {
    expect(calcularRisco({ ...base, faltas: 0, atendimentos: 0 }).pontos).toBe(0);
  });

  it('AC 2: primeira consulta soma 25', () => {
    expect(calcularRisco({ ...base, primeiraConsulta: true })).toMatchObject({
      pontos: PESOS.primeiraConsulta,
      fatores: [{ codigo: 'primeiraConsulta', pontos: 25 }],
    });
  });

  it('AC 3: convênio soma 15', () => {
    expect(calcularRisco({ ...base, tipoAtendimento: 'convenio' })).toMatchObject({
      pontos: 15,
      fatores: [{ codigo: 'convenio', pontos: 15 }],
    });
  });

  it('AC 4: segunda 11:30 soma e segunda 12:00 não', () => {
    // 12/10/2026 é segunda-feira.
    expect(codigos({ ...base, inicio: new Date('2026-10-12T11:30:00-03:00') })).toEqual(['segundaDeManha']);
    expect(codigos({ ...base, inicio: new Date('2026-10-12T12:00:00-03:00') })).toEqual([]);
  });

  it('AC 4: terça de manhã não soma', () => {
    expect(codigos({ ...base, inicio: new Date('2026-10-13T08:00:00-03:00') })).toEqual([]);
  });

  it('AC 5: agendada a 47h59 soma e a 48h exatas não', () => {
    const agendada = { ...base, status: 'agendada' as const };
    const inicio47 = new Date(AGORA.getTime() + (48 * 60 - 1) * 60_000);
    const inicio48 = new Date(AGORA.getTime() + 48 * 60 * 60_000);
    expect(codigos({ ...agendada, inicio: inicio47 })).toEqual(['semConfirmacao']);
    expect(codigos({ ...agendada, inicio: inicio48 })).toEqual([]);
  });

  it('AC 5: confirmada a menos de 48h não soma', () => {
    const inicio = new Date(AGORA.getTime() + 60 * 60_000);
    expect(codigos({ ...base, status: 'confirmada', inicio })).toEqual([]);
  });

  it('AC 10: devolve a lista dos fatores que somaram', () => {
    const r = calcularRisco({ ...base, primeiraConsulta: true, tipoAtendimento: 'convenio' });
    expect(r.fatores).toEqual([
      { codigo: 'primeiraConsulta', pontos: 25 },
      { codigo: 'convenio', pontos: 15 },
    ]);
    expect(r.pontos).toBe(40);
    expect(r.nivel).toBe('media');
  });

  it('AC 11: todos os fatores somam 115 e vêm da lista única de pesos', () => {
    const r = calcularRisco({
      ...base,
      inicio: new Date('2026-10-12T09:00:00-03:00'),
      agora: new Date('2026-10-11T09:00:00-03:00'),
      status: 'agendada',
      tipoAtendimento: 'convenio',
      primeiraConsulta: true,
      faltas: 2,
      atendimentos: 2,
    });
    expect(r.pontos).toBe(Object.values(PESOS).reduce((a, b) => a + b, 0));
    expect(r.nivel).toBe('muito_alta');
    expect(FATORES.map((fator) => fator.codigo).sort()).toEqual(Object.keys(PESOS).sort());
  });
});

describe('classificar: fronteiras (AC 6 a 9)', () => {
  it.each([
    [0, 'baixo'],
    [24, 'baixo'],
    [25, 'media'],
    [49, 'media'],
    [50, 'alta'],
    [69, 'alta'],
    [70, 'muito_alta'],
    [115, 'muito_alta'],
  ] as const)('%i pontos é %s', (pontos, nivel) => {
    expect(classificar(pontos)).toBe(nivel);
  });

  it('cortes são 25, 50 e 70', () => {
    expect(CORTES).toEqual({ media: 25, alta: 50, muitoAlta: 70 });
  });
});

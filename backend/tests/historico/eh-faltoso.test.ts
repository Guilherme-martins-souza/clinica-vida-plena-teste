import { describe, expect, it } from 'vitest';
import { ehFaltoso, type Historico } from '../../src/historico/historico';

// Monta o histórico a partir dos últimos atendimentos (true = falta), do mais recente para o mais antigo.
function historico(ultimos5: boolean[], faltas = ultimos5.filter(Boolean).length): Historico {
  return { faltas, atendimentos: ultimos5.length, ultimos5 };
}

describe('ehFaltoso (FALT-01)', () => {
  it('0 atendimentos não é faltoso', () => {
    expect(ehFaltoso(historico([]))).toBe(false);
  });

  it('1 atendimento com falta (100%) é faltoso', () => {
    expect(ehFaltoso(historico([true]))).toBe(true);
  });

  it('1 atendimento sem falta não é faltoso', () => {
    expect(ehFaltoso(historico([false]))).toBe(false);
  });

  it('1 falta em 4 (25%) é faltoso', () => {
    expect(ehFaltoso(historico([false, true, false, false]))).toBe(true);
  });

  it('1 falta em 5 (20%) não é faltoso', () => {
    expect(ehFaltoso(historico([false, false, true, false, false]))).toBe(false);
  });

  it('2 faltas em 5 (40%) é faltoso', () => {
    expect(ehFaltoso(historico([true, false, true, false, false]))).toBe(true);
  });

  it('só os 5 últimos entram, mesmo que a lista venha maior', () => {
    // 5 últimos sem falta; a falta antiga (6ª) não conta.
    const lista = [false, false, false, false, false, true, true];
    expect(ehFaltoso({ faltas: 2, atendimentos: 7, ultimos5: lista })).toBe(false);
  });

  it('faltas antigas fora dos 5 últimos não tornam faltoso', () => {
    expect(ehFaltoso({ faltas: 4, atendimentos: 20, ultimos5: [false, false, false, false, false] })).toBe(false);
  });
});

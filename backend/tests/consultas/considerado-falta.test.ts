import { describe, expect, it } from 'vitest';
import { calcularConsideradoFalta } from '../../src/consultas/considerado-falta';

const inicio = new Date('2026-03-10T15:00:00.000Z');
const horasAntes = (horas: number, minutos = 0) => new Date(inicio.getTime() - (horas * 60 + minutos) * 60 * 1000);

describe('calcularConsideradoFalta', () => {
  it('status falta conta', () => {
    expect(calcularConsideradoFalta('falta', inicio, null)).toBe(true);
  });

  it('cancelada pelo paciente a 23h59 conta', () => {
    expect(calcularConsideradoFalta('cancelada_paciente', inicio, horasAntes(23, 59))).toBe(true);
  });

  it('cancelada pelo paciente a exatamente 24h não conta', () => {
    expect(calcularConsideradoFalta('cancelada_paciente', inicio, horasAntes(24))).toBe(false);
  });

  it('cancelada pelo paciente a 48h não conta', () => {
    expect(calcularConsideradoFalta('cancelada_paciente', inicio, horasAntes(48))).toBe(false);
  });

  it('cancelada pelo paciente sem canceladaEm não conta', () => {
    expect(calcularConsideradoFalta('cancelada_paciente', inicio, null)).toBe(false);
  });

  it.each(['cancelada_clinica', 'realizada', 'agendada', 'confirmada'] as const)('%s não conta', (status) => {
    expect(calcularConsideradoFalta(status, inicio, horasAntes(2))).toBe(false);
  });
});

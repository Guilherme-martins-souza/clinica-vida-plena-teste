import { describe, expect, it } from 'vitest';
import { lerDataHora, normalizarStatus, normalizarTipo } from '../../src/importacao/normalizar';

describe('lerDataHora', () => {
  it('lê os dois formatos como o mesmo instante no fuso de São Paulo', () => {
    const iso = lerDataHora('2025-09-26 10:00');
    const br = lerDataHora('26/09/2025 10:00');

    expect(iso?.instante.toISOString()).toBe('2025-09-26T13:00:00.000Z');
    expect(br?.instante.toISOString()).toBe('2025-09-26T13:00:00.000Z');
    expect(iso?.formatoBr).toBe(false);
    expect(br?.formatoBr).toBe(true);
  });

  it('devolve as partes da data e o dia da semana', () => {
    expect(lerDataHora('26/09/2025 10:30')).toMatchObject({
      ano: 2025,
      mes: 9,
      dia: 26,
      hora: 10,
      minuto: 30,
      diaSemana: 'sexta',
    });
    expect(lerDataHora('2025-09-28 08:00')?.diaSemana).toBe('domingo');
    expect(lerDataHora('2025-09-29 08:00')?.diaSemana).toBe('segunda');
  });

  it.each(['31/02/2026 10:00', '2026-13-01 10:00', '2026-01-10 24:00', 'ontem', ''])(
    'devolve null para data ilegível ou inexistente: %j',
    (texto) => {
      expect(lerDataHora(texto)).toBeNull();
    },
  );
});

describe('normalizarStatus', () => {
  it.each([
    ['atendido', 'realizada'],
    ['falta', 'falta'],
    ['faltou', 'falta'],
    ['no_show', 'falta'],
    ['ausente', 'falta'],
    ['agendada', 'agendada'],
    ['confirmada', 'confirmada'],
    ['confirmado', 'confirmada'],
    ['cancelada_paciente', 'cancelada_paciente'],
    ['cancelado pelo paciente', 'cancelada_paciente'],
    ['desmarcou', 'cancelada_paciente'],
    ['cancelada_clinica', 'cancelada_clinica'],
    ['cancelado clinica', 'cancelada_clinica'],
    ['  REALIZADA ', 'realizada'],
    [' Faltou', 'falta'],
    ['Agendada', 'agendada'],
    ['CANCELADO PELO PACIENTE ', 'cancelada_paciente'],
  ])('%j vira %s', (texto, status) => {
    expect(normalizarStatus(texto)?.status).toBe(status);
  });

  it('marca status_padronizado quando o texto não é o status oficial', () => {
    expect(normalizarStatus('realizada')).toEqual({ status: 'realizada' });
    expect(normalizarStatus('Realizada')).toEqual({ status: 'realizada', correcao: 'status_padronizado' });
    expect(normalizarStatus('atendido')).toEqual({ status: 'realizada', correcao: 'status_padronizado' });
    expect(normalizarStatus('desmarcou')).toEqual({ status: 'cancelada_paciente', correcao: 'status_padronizado' });
  });

  it('cancelado sem autor vira cancelada_clinica com a correção cancelado_sem_autor', () => {
    expect(normalizarStatus('cancelado')).toEqual({ status: 'cancelada_clinica', correcao: 'cancelado_sem_autor' });
    expect(normalizarStatus('Cancelado')).toEqual({ status: 'cancelada_clinica', correcao: 'cancelado_sem_autor' });
  });

  it('status vazio devolve status vazio, sem correção', () => {
    expect(normalizarStatus('')).toEqual({ status: '' });
    expect(normalizarStatus('  ')).toEqual({ status: '' });
  });

  it('status fora da tabela devolve null', () => {
    expect(normalizarStatus('talvez')).toBeNull();
  });
});

describe('normalizarTipo', () => {
  it.each([
    ['convenio', 'convenio', false],
    ['particular', 'particular', false],
    ['Convênio', 'convenio', true],
    ['convênio', 'convenio', true],
    ['CONVENIO', 'convenio', true],
    ['PARTICULAR', 'particular', true],
    ['Particular', 'particular', true],
  ])('%j vira %s (corrigido: %s)', (texto, tipo, corrigido) => {
    expect(normalizarTipo(texto)).toEqual({ tipo, corrigido });
  });

  it('tipo fora da lista devolve null', () => {
    expect(normalizarTipo('outro')).toBeNull();
    expect(normalizarTipo('')).toBeNull();
  });
});

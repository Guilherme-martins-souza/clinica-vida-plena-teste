import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iniciarAgendador } from '../../src/mensagens/agendador';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('iniciarAgendador', () => {
  it('roda a cada 60 s com a hora atual', async () => {
    const rodada = vi.fn().mockResolvedValue(undefined);
    const timer = iniciarAgendador(rodada);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(rodada).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(rodada).toHaveBeenCalledTimes(1);
    expect(rodada.mock.calls[0][0]).toEqual(new Date('2026-10-12T12:01:00Z'));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(rodada).toHaveBeenCalledTimes(2);
    clearInterval(timer);
  });

  it('não sobrepõe: rodada lenta faz a seguinte ser pulada', async () => {
    let terminar: () => void = () => {};
    const rodada = vi.fn(() => new Promise<void>((ok) => (terminar = ok)));
    const timer = iniciarAgendador(rodada);

    await vi.advanceTimersByTimeAsync(180_000);
    expect(rodada).toHaveBeenCalledTimes(1);

    terminar();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rodada).toHaveBeenCalledTimes(2);
    clearInterval(timer);
  });

  it('uma rodada que falha não impede a próxima', async () => {
    const rodada = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const timer = iniciarAgendador(rodada);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(rodada).toHaveBeenCalledTimes(2);
    clearInterval(timer);
    log.mockRestore();
  });
});

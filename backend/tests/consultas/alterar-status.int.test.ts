import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { alterarStatus } from '../../src/consultas/alterar-status';
import { HttpError } from '../../src/errors';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// Consulta às 09:00 de 12/10/2026 (São Paulo); "agora" é uma hora antes.
const INICIO = new Date('2026-10-12T09:00:00-03:00');
const ANTES = new Date('2026-10-12T08:00:00-03:00');

async function consultaCom(status: StatusConsulta): Promise<string> {
  const consulta = await Consulta.create({
    codigoLegado: null,
    pacienteId: 'PAC0001',
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio: INICIO,
    marcadaEm: new Date('2026-10-01T10:00:00-03:00'),
    canceladaEm: null,
    status,
    consideradoFalta: false,
  });
  return String(consulta._id);
}

beforeAll(async () => {
  await conectarBancoDeTeste('consultas_alterar_status');
  await Consulta.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('alterarStatus', () => {
  it('cancelamento grava canceladaEm = agora (AGD-02 AC 6)', async () => {
    const id = await consultaCom('agendada');

    const consulta = await alterarStatus(id, 'cancelada_clinica', ANTES);

    expect(consulta.status).toBe('cancelada_clinica');
    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.status).toBe('cancelada_clinica');
    expect(gravada?.canceladaEm).toEqual(ANTES);
  });

  it('confirmação não grava canceladaEm (AGD-02 AC 6)', async () => {
    const id = await consultaCom('agendada');

    await alterarStatus(id, 'confirmada', ANTES);

    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.status).toBe('confirmada');
    expect(gravada?.canceladaEm).toBeNull();
  });

  it('falta grava consideradoFalta = true (CAMPO-01 AC 2)', async () => {
    const id = await consultaCom('agendada');
    const depois = new Date('2026-10-12T10:00:00-03:00');

    await alterarStatus(id, 'falta', depois);

    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.consideradoFalta).toBe(true);
  });

  it('cancelamento do paciente a 2h do início grava consideradoFalta = true (CAMPO-01 AC 3)', async () => {
    const id = await consultaCom('agendada');
    const duasHorasAntes = new Date('2026-10-12T07:00:00-03:00');

    const consulta = await alterarStatus(id, 'cancelada_paciente', duasHorasAntes);

    expect(consulta.status).toBe('cancelada_paciente');
    expect(consulta.consideradoFalta).toBe(true);
    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.consideradoFalta).toBe(true);
  });

  it('cancelamento do paciente a 30h do início grava consideradoFalta = false (CAMPO-01 AC 4)', async () => {
    const id = await consultaCom('agendada');
    const trintaHorasAntes = new Date('2026-10-11T03:00:00-03:00');

    await alterarStatus(id, 'cancelada_paciente', trintaHorasAntes);

    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.consideradoFalta).toBe(false);
  });

  it('cancelamento da clínica a 2h do início grava consideradoFalta = false (CAMPO-01 AC 4)', async () => {
    const id = await consultaCom('agendada');
    const duasHorasAntes = new Date('2026-10-12T07:00:00-03:00');

    await alterarStatus(id, 'cancelada_clinica', duasHorasAntes);

    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.consideradoFalta).toBe(false);
  });

  it('confirmada e realizada gravam consideradoFalta = false', async () => {
    const confirmada = await consultaCom('agendada');
    const realizada = await consultaCom('confirmada');
    const depois = new Date('2026-10-12T10:00:00-03:00');

    await alterarStatus(confirmada, 'confirmada', ANTES);
    await alterarStatus(realizada, 'realizada', depois);

    expect((await Consulta.findById(confirmada).lean())?.consideradoFalta).toBe(false);
    expect((await Consulta.findById(realizada).lean())?.consideradoFalta).toBe(false);
  });

  it('duas trocas concorrentes a partir de agendada: só uma vale, a outra é 409 STATUS_ALTERADO (AGD-02 AC 8)', async () => {
    const id = await consultaCom('agendada');

    const resultados = await Promise.allSettled([
      alterarStatus(id, 'confirmada', ANTES),
      alterarStatus(id, 'cancelada_paciente', ANTES),
    ]);

    const cumpridas = resultados.filter((r) => r.status === 'fulfilled');
    const rejeitadas = resultados.filter((r) => r.status === 'rejected');
    expect(cumpridas).toHaveLength(1);
    expect(rejeitadas).toHaveLength(1);
    const motivo: unknown = rejeitadas[0]?.status === 'rejected' ? rejeitadas[0].reason : null;
    expect(motivo).toBeInstanceOf(HttpError);
    expect(motivo instanceof HttpError && motivo.status).toBe(409);
    expect(motivo instanceof HttpError && motivo.code).toBe('STATUS_ALTERADO');

    // O banco fica com o status da troca que deu certo.
    const vencedora = cumpridas[0]?.status === 'fulfilled' ? cumpridas[0].value.status : null;
    const gravada = await Consulta.findById(id).lean();
    expect(gravada?.status).toBe(vencedora);
  });
});

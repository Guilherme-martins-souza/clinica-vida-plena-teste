import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { criarEstado, rodarAgendador, type EstadoAgendador } from '../../src/mensagens/agendador';
import { configurarEnviador } from '../../src/mensagens/enviar';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const AGORA = new Date('2026-10-12T12:00:00Z');
const HORA = 3_600_000;
const UM_MINUTO_ANTES = new Date(AGORA.getTime() - 60_000);
const enviador = vi.fn();
let estado: EstadoAgendador;
let erroNoLog: MockInstance;

// Cria uma consulta que começa `horas` depois de AGORA.
async function consulta(horas: number, status: StatusConsulta = 'agendada', pacienteId = 'PAC0001') {
  const inicio = new Date(AGORA.getTime() + horas * HORA);
  return Consulta.create({ pacienteId, medicoId: 'MED01', tipoAtendimento: 'particular', inicio, status });
}

function tiposEnviados(): string[] {
  return enviador.mock.calls.map((chamada) => chamada[0].tipo);
}

beforeAll(async () => {
  await conectarBancoDeTeste('mensagens_agendador');
});

beforeEach(async () => {
  await limparBanco();
  enviador.mockReset().mockResolvedValue(undefined);
  configurarEnviador(enviador);
  estado = criarEstado();
  erroNoLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  erroNoLog.mockClear();
  await Medico.create({ _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] });
  await Paciente.create([
    { _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' },
    { _id: 'PAC0002', nome: 'João Souza', telefone: null },
    { _id: 'PAC0003', nome: 'Ana Lima', telefone: '11987654321' },
  ]);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await desconectar();
});

describe('rodarAgendador', () => {
  it('72h exatas envia a mensagem 2', async () => {
    await consulta(72);
    await rodarAgendador(AGORA, estado);
    expect(tiposEnviados()).toEqual(['confirmacao']);
  });

  it('72h01 não envia nada', async () => {
    await consulta(72);
    await rodarAgendador(UM_MINUTO_ANTES, estado);
    expect(enviador).not.toHaveBeenCalled();
  });

  it('36h exatas envia a mensagem 3 (além da 2, ainda não enviada)', async () => {
    await consulta(36);
    await rodarAgendador(AGORA, estado);
    expect(tiposEnviados().sort()).toEqual(['confirmacao', 'lembrete']);
  });

  it('36h01 envia só a mensagem 2', async () => {
    await consulta(36);
    await rodarAgendador(UM_MINUTO_ANTES, estado);
    expect(tiposEnviados()).toEqual(['confirmacao']);
  });

  it('confirmada recebe a 2 mas não a 3', async () => {
    await consulta(24, 'confirmada');
    await rodarAgendador(AGORA, estado);
    expect(tiposEnviados()).toEqual(['confirmacao']);
  });

  it.each(['cancelada_paciente', 'cancelada_clinica', 'realizada', 'falta'] as const)(
    '%s não recebe nada',
    async (status) => {
      await consulta(24, status);
      await rodarAgendador(AGORA, estado);
      expect(enviador).not.toHaveBeenCalled();
    },
  );

  it('consulta que já passou não recebe nada', async () => {
    await consulta(-1);
    await rodarAgendador(AGORA, estado);
    expect(enviador).not.toHaveBeenCalled();
  });

  it('não repete a mesma mensagem da mesma consulta na rodada seguinte', async () => {
    await consulta(24);
    await rodarAgendador(AGORA, estado);
    await rodarAgendador(new Date(AGORA.getTime() + 60_000), estado);
    expect(tiposEnviados().sort()).toEqual(['confirmacao', 'lembrete']);
  });

  it('para no 4º envio do mesmo tipo', async () => {
    for (const h of [10, 11, 12, 13]) {
      await consulta(h, 'confirmada', h === 11 ? 'PAC0003' : 'PAC0001');
    }
    // Quatro consultas confirmadas (horários diferentes): só 3 recebem a mensagem 2.
    await rodarAgendador(AGORA, estado);
    await rodarAgendador(new Date(AGORA.getTime() + 60_000), estado);

    expect(tiposEnviados()).toEqual(['confirmacao', 'confirmacao', 'confirmacao']);
    expect(estado.porTipo.confirmacao).toBe(3);
  });

  it('falha do enviador não conta e tenta de novo na rodada seguinte', async () => {
    await consulta(24, 'confirmada');
    enviador.mockRejectedValueOnce(new Error('fora do ar'));

    await rodarAgendador(AGORA, estado);
    expect(estado.porTipo.confirmacao).toBe(0);

    await rodarAgendador(new Date(AGORA.getTime() + 60_000), estado);
    expect(estado.porTipo.confirmacao).toBe(1);
    expect(enviador).toHaveBeenCalledTimes(2);
  });

  it('AC 9: falha do enviador é registrada no log', async () => {
    await consulta(24, 'confirmada');
    enviador.mockRejectedValueOnce(new Error('fora do ar'));

    await rodarAgendador(AGORA, estado);

    expect(erroNoLog).toHaveBeenCalledWith(
      expect.stringContaining('Agendador: falha ao enviar confirmacao'),
      expect.anything(),
    );
  });

  it('paciente sem telefone é pulado e as demais consultas seguem', async () => {
    await consulta(10, 'confirmada', 'PAC0002');
    await consulta(11, 'confirmada', 'PAC0003');

    await rodarAgendador(AGORA, estado);

    expect(enviador).toHaveBeenCalledTimes(1);
    expect(enviador.mock.calls[0][0].to).toBe('11987654321');
    expect(erroNoLog).not.toHaveBeenCalled();
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { calcularConsideradoFalta } from '../../src/consultas/considerado-falta';
import { historicoDe } from '../../src/historico/historico';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const AGORA = new Date('2026-10-10T12:00:00-03:00');
const HORA = 60 * 60 * 1000;

async function consulta(pacienteId: string, dia: string, status: StatusConsulta, canceladaHorasAntes?: number) {
  const inicio = new Date(`${dia}T09:00:00-03:00`);
  const canceladaEm =
    canceladaHorasAntes === undefined ? null : new Date(inicio.getTime() - canceladaHorasAntes * HORA);
  await Consulta.create({
    codigoLegado: null,
    pacienteId,
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio,
    marcadaEm: null,
    canceladaEm,
    status,
    consideradoFalta: calcularConsideradoFalta(status, inicio, canceladaEm),
  });
}

beforeAll(async () => {
  await conectarBancoDeTeste('historico_de');
  await Consulta.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('historicoDe (FALT-01)', () => {
  it('conta faltas e atendimentos e ordena os últimos do mais recente para o mais antigo', async () => {
    await consulta('PAC1', '2026-09-01', 'realizada');
    await consulta('PAC1', '2026-09-02', 'falta');
    await consulta('PAC1', '2026-09-03', 'realizada');

    const historico = (await historicoDe(['PAC1'], AGORA)).get('PAC1');

    expect(historico).toEqual({ faltas: 1, atendimentos: 3, ultimos5: [false, true, false] });
  });

  it('guarda só os 5 últimos, mas conta todo o histórico', async () => {
    for (let dia = 1; dia <= 7; dia++) {
      await consulta('PAC1', `2026-09-0${dia}`, dia === 1 ? 'falta' : 'realizada');
    }

    const historico = (await historicoDe(['PAC1'], AGORA)).get('PAC1');

    expect(historico?.atendimentos).toBe(7);
    expect(historico?.faltas).toBe(1);
    expect(historico?.ultimos5).toEqual([false, false, false, false, false]);
  });

  it('ignora futuras, canceladas com antecedência, canceladas pela clínica, agendadas e confirmadas', async () => {
    await consulta('PAC1', '2026-10-20', 'realizada');
    await consulta('PAC1', '2026-10-20', 'falta');
    await consulta('PAC1', '2026-09-04', 'cancelada_paciente', 48);
    await consulta('PAC1', '2026-09-05', 'cancelada_clinica', 1);
    await consulta('PAC1', '2026-09-06', 'agendada');
    await consulta('PAC1', '2026-09-07', 'confirmada');

    const historico = (await historicoDe(['PAC1'], AGORA)).get('PAC1');

    expect(historico).toEqual({ faltas: 0, atendimentos: 0, ultimos5: [] });
  });

  it('fronteira: início exatamente igual a agora não entra; um instante depois entra', async () => {
    await consulta('PAC1', '2026-09-01', 'falta');
    const inicio = new Date('2026-09-01T09:00:00-03:00');

    expect((await historicoDe(['PAC1'], inicio)).get('PAC1')).toEqual({ faltas: 0, atendimentos: 0, ultimos5: [] });

    const umMsDepois = new Date(inicio.getTime() + 1);
    expect((await historicoDe(['PAC1'], umMsDepois)).get('PAC1')).toEqual({
      faltas: 1,
      atendimentos: 1,
      ultimos5: [true],
    });
  });

  it('cancelamento tardio (consideradoFalta) conta como falta', async () => {
    await consulta('PAC1', '2026-09-04', 'cancelada_paciente', 2);

    const historico = (await historicoDe(['PAC1'], AGORA)).get('PAC1');

    expect(historico).toEqual({ faltas: 1, atendimentos: 1, ultimos5: [true] });
  });

  it('paciente sem consulta devolve histórico zerado, e cada paciente tem o seu', async () => {
    await consulta('PAC1', '2026-09-01', 'falta');

    const historicos = await historicoDe(['PAC1', 'PAC2'], AGORA);

    expect(historicos.get('PAC1')?.faltas).toBe(1);
    expect(historicos.get('PAC2')).toEqual({ faltas: 0, atendimentos: 0, ultimos5: [] });
  });
});

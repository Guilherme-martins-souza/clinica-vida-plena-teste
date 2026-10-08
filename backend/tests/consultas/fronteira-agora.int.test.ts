import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { horariosDoDia } from '../../src/consultas/horarios';
import { contarAbas } from '../../src/consultas/listar-consultas';
import { Consulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// 12/10/2026 é segunda-feira. "agora" dos testes: exatamente o início do slot das 09:00 em São Paulo.
const AGORA = new Date('2026-10-12T09:00:00-03:00');

function emSaoPaulo(dataHora: string): Date {
  return new Date(`${dataHora}:00-03:00`);
}

async function criarConsulta(inicio: Date) {
  await Consulta.create({
    codigoLegado: null,
    pacienteId: 'PAC0001',
    medicoId: 'MED01',
    tipoAtendimento: 'particular',
    inicio,
    marcadaEm: new Date('2026-10-01T10:00:00-03:00'),
    canceladaEm: null,
    status: 'agendada',
  });
}

beforeAll(async () => {
  await conectarBancoDeTeste('consultas_fronteira_agora');
  await Promise.all([Medico.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create({
    _id: 'MED01',
    nome: 'Dr. Paulo Mendes',
    especialidade: 'Cardiologia',
    grade: [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }],
  });
});

afterAll(async () => {
  await desconectar();
});

describe('slot que começa exatamente agora (AGD-03 AC5)', () => {
  it('é "passado"; o slot seguinte é "livre"', async () => {
    const { slots } = await horariosDoDia('MED01', '2026-10-12', AGORA);

    const situacaoDe = (hora: string) =>
      slots.find((s) => s.inicio.getTime() === emSaoPaulo(`2026-10-12T${hora}`).getTime())?.situacao;
    expect(situacaoDe('08:30')).toBe('passado');
    expect(situacaoDe('09:00')).toBe('passado');
    expect(situacaoDe('09:30')).toBe('livre');
  });

  it('é "passado" mesmo com consulta marcada nele', async () => {
    await criarConsulta(AGORA);

    const { slots } = await horariosDoDia('MED01', '2026-10-12', AGORA);

    expect(slots.find((s) => s.inicio.getTime() === AGORA.getTime())?.situacao).toBe('passado');
  });
});

describe('abas no instante exato de agora', () => {
  it('consulta começando agora conta em "próximas"; a de 30 min antes, em "aguardando"', async () => {
    await criarConsulta(AGORA);
    await criarConsulta(new Date(AGORA.getTime() - 30 * 60 * 1000));

    const abas = await contarAbas({}, AGORA);

    expect(abas.proximas).toBe(1);
    expect(abas.aguardando).toBe(1);
  });
});

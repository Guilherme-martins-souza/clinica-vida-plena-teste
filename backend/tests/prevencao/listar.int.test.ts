import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Consulta, type DadosConsulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { listarPrevencao } from '../../src/prevencao/listar';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// Segunda-feira 2026-10-12, 09:00 em São Paulo. A janela vai até o fim de 2026-10-26.
const AGORA = new Date('2026-10-12T12:00:00Z');

// Os 3 níveis aparecem; o risco baixo, os status finais e o que está fora da janela ficam de fora.
const CONSULTAS: Array<[string, Partial<DadosConsulta> & Pick<DadosConsulta, 'pacienteId' | 'inicio'>]> = [
  // 25 (primeira) + 15 (convênio) = 40: média. Mais de 48 h, sem o fator de confirmação.
  ['media', { pacienteId: 'PAC0001', tipoAtendimento: 'convenio', inicio: new Date('2026-10-15T14:00:00-03:00') }],
  // 25 + 15 + 20 (agendada a menos de 48 h) = 60: alta.
  ['alta', { pacienteId: 'PAC0002', tipoAtendimento: 'convenio', inicio: new Date('2026-10-13T14:00:00-03:00') }],
  // 40 (2 faltas) + 15 + 20 = 75: muito alta.
  ['muitoAlta', { pacienteId: 'PAC0003', tipoAtendimento: 'convenio', inicio: new Date('2026-10-13T15:00:00-03:00') }],
  // Confirmada: 25 + 15 = 40, sem o fator de confirmação.
  [
    'confirmada',
    {
      pacienteId: 'PAC0010',
      tipoAtendimento: 'convenio',
      inicio: new Date('2026-10-16T10:00:00-03:00'),
      status: 'confirmada',
    },
  ],
  // Último minuto do 14º dia: ainda entra.
  ['ultimoDia', { pacienteId: 'PAC0006', tipoAtendimento: 'convenio', inicio: new Date('2026-10-26T23:30:00-03:00') }],
  // Risco baixo: paciente com atendimento anterior, particular.
  ['baixo', { pacienteId: 'PAC0004', tipoAtendimento: 'particular', inicio: new Date('2026-10-20T10:00:00-03:00') }],
  // Depois do 14º dia.
  [
    'depoisDaJanela',
    { pacienteId: 'PAC0005', tipoAtendimento: 'convenio', inicio: new Date('2026-10-27T00:00:00-03:00') },
  ],
  // Já começou (08:00 de hoje) e continua agendada.
  ['jaPassou', { pacienteId: 'PAC0009', tipoAtendimento: 'convenio', inicio: new Date('2026-10-12T08:00:00-03:00') }],
  [
    'cancelada',
    {
      pacienteId: 'PAC0007',
      tipoAtendimento: 'convenio',
      inicio: new Date('2026-10-14T10:00:00-03:00'),
      status: 'cancelada_paciente',
    },
  ],
  [
    'realizada',
    {
      pacienteId: 'PAC0008',
      tipoAtendimento: 'convenio',
      inicio: new Date('2026-10-14T11:00:00-03:00'),
      status: 'realizada',
    },
  ],
  // Histórico dos pacientes (consultas já ocorridas).
  [
    'faltaAntiga1',
    {
      pacienteId: 'PAC0003',
      tipoAtendimento: 'particular',
      inicio: new Date('2026-09-01T10:00:00-03:00'),
      status: 'falta',
      consideradoFalta: true,
    },
  ],
  [
    'faltaAntiga2',
    {
      pacienteId: 'PAC0003',
      tipoAtendimento: 'particular',
      inicio: new Date('2026-09-08T10:00:00-03:00'),
      status: 'falta',
      consideradoFalta: true,
    },
  ],
  [
    'atendimentoAntigo',
    {
      pacienteId: 'PAC0004',
      tipoAtendimento: 'particular',
      inicio: new Date('2026-09-01T10:00:00-03:00'),
      status: 'realizada',
    },
  ],
];

const ids = {} as Record<string, string>;
const PAGINACAO = { pagina: 1, porPagina: 10 };

function nomesDe(itens: { id: string }[]): string[] {
  const porId = new Map(Object.entries(ids).map(([nome, id]) => [id, nome]));
  return itens.map((item) => porId.get(item.id) ?? item.id);
}

beforeAll(async () => {
  await conectarBancoDeTeste('prevencao_listar');
  await Promise.all([Medico.init(), Paciente.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create({ _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] });
  const pacientes = Array.from({ length: 10 }, (_, i) => ({
    _id: `PAC${String(i + 1).padStart(4, '0')}`,
    nome: `Paciente ${i + 1}`,
    telefone: '53948954499',
  }));
  await Paciente.create(pacientes);
  for (const [nome, dados] of CONSULTAS) {
    const criada = await Consulta.create({ medicoId: 'MED01', status: 'agendada', ...dados });
    ids[nome] = String(criada._id);
  }
});

afterAll(async () => {
  await desconectar();
});

describe('listarPrevencao', () => {
  it('lista em ordem cronológica só o que tem risco média ou maior, dentro dos 14 dias', async () => {
    const pagina = await listarPrevencao({}, PAGINACAO, AGORA);
    expect(nomesDe(pagina.itens)).toEqual(['alta', 'muitoAlta', 'media', 'confirmada', 'ultimoDia']);
    expect(pagina.total).toBe(5);
  });

  it('exclui canceladas, finalizadas, risco baixo, consultas passadas e depois do 14º dia', async () => {
    const pagina = await listarPrevencao({}, PAGINACAO, AGORA);
    const nomes = nomesDe(pagina.itens);
    for (const fora of ['cancelada', 'realizada', 'baixo', 'depoisDaJanela', 'jaPassou', 'faltaAntiga1']) {
      expect(nomes).not.toContain(fora);
    }
  });

  it('pagina em memória de 2 em 2', async () => {
    const p1 = await listarPrevencao({}, { pagina: 1, porPagina: 2 }, AGORA);
    const p3 = await listarPrevencao({}, { pagina: 3, porPagina: 2 }, AGORA);
    expect(nomesDe(p1.itens)).toEqual(['alta', 'muitoAlta']);
    expect(nomesDe(p3.itens)).toEqual(['ultimoDia']);
    expect(p3.total).toBe(5);
  });

  it('filtro por nível devolve só aquele nível', async () => {
    const media = await listarPrevencao({ nivel: 'media' }, PAGINACAO, AGORA);
    const alta = await listarPrevencao({ nivel: 'alta' }, PAGINACAO, AGORA);
    const muitoAlta = await listarPrevencao({ nivel: 'muito_alta' }, PAGINACAO, AGORA);
    expect(nomesDe(media.itens)).toEqual(['media', 'confirmada', 'ultimoDia']);
    expect(nomesDe(alta.itens)).toEqual(['alta']);
    expect(nomesDe(muitoAlta.itens)).toEqual(['muitoAlta']);
    expect(muitoAlta.total).toBe(1);
  });

  it('cada item traz o risco (pontos, nível e fatores) e o faltoso', async () => {
    const pagina = await listarPrevencao({ nivel: 'muito_alta' }, PAGINACAO, AGORA);
    const item = pagina.itens[0];
    expect(item.risco).toEqual({
      pontos: 75,
      nivel: 'muito_alta',
      fatores: [
        { codigo: 'historico', pontos: 40 },
        { codigo: 'convenio', pontos: 15 },
        { codigo: 'semConfirmacao', pontos: 20 },
      ],
    });
    expect(item.faltoso).toBe(true);
    expect(item.paciente).toEqual({ id: 'PAC0003', nome: 'Paciente 3', telefone: '53948954499' });
    expect(item.medico.nome).toBe('Dr. Paulo Mendes');
    expect(item.status).toBe('agendada');
  });
});

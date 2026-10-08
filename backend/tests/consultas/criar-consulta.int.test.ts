import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarConsulta, type NovaConsulta } from '../../src/consultas/criar-consulta';
import { HttpError } from '../../src/errors';
import { Consulta, type StatusConsulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// 12/10/2026 é segunda-feira. "agora" dos testes: segunda 12/10/2026, 08:00 em São Paulo.
const AGORA = new Date('2026-10-12T08:00:00-03:00');

function emSaoPaulo(dataHora: string): Date {
  return new Date(`${dataHora}:00-03:00`);
}

function nova(campos: Partial<NovaConsulta> = {}): NovaConsulta {
  return {
    pacienteId: 'PAC0001',
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio: emSaoPaulo('2026-10-12T09:00'),
    ...campos,
  };
}

// Consulta já gravada no banco, para montar os conflitos.
async function existente(medicoId: string, pacienteId: string, inicio: Date, status: StatusConsulta) {
  await Consulta.create({
    codigoLegado: null,
    pacienteId,
    medicoId,
    tipoAtendimento: 'particular',
    inicio,
    marcadaEm: new Date('2026-10-01T10:00:00-03:00'),
    canceladaEm: null,
    status,
  });
}

// Executa e devolve o HttpError lançado (falha o teste se não lançar).
async function erroDe(promessa: Promise<unknown>): Promise<HttpError> {
  try {
    await promessa;
  } catch (erro) {
    if (erro instanceof HttpError) {
      return erro;
    }
    throw erro;
  }
  throw new Error('Era esperado um HttpError');
}

beforeAll(async () => {
  await conectarBancoDeTeste('consultas_criar');
  await Promise.all([Medico.init(), Paciente.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create([
    {
      _id: 'MED01',
      nome: 'Dr. Paulo Mendes',
      especialidade: 'Cardiologia',
      grade: [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }],
    },
    {
      _id: 'MED02',
      nome: 'Dra. Ana Ribeiro',
      especialidade: 'Dermatologia',
      grade: [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }],
    },
  ]);
  await Paciente.create([
    { _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' },
    { _id: 'PAC0002', nome: 'João Souza', telefone: null },
  ]);
});

afterAll(async () => {
  await desconectar();
});

describe('criarConsulta', () => {
  it('grava a consulta agendada, marcada agora e sem código legado (AC 1)', async () => {
    const consulta = await criarConsulta(nova(), AGORA);

    const gravada = await Consulta.findById(consulta._id).lean();
    expect(gravada).toMatchObject({
      pacienteId: 'PAC0001',
      medicoId: 'MED01',
      tipoAtendimento: 'convenio',
      inicio: emSaoPaulo('2026-10-12T09:00'),
      status: 'agendada',
      marcadaEm: AGORA,
      codigoLegado: null,
      canceladaEm: null,
    });
    expect(await Consulta.countDocuments()).toBe(1);
  });

  it('médico inexistente → 404 MEDICO_NAO_ENCONTRADO (AC 3)', async () => {
    const erro = await erroDe(criarConsulta(nova({ medicoId: 'MED99' }), AGORA));
    expect(erro.status).toBe(404);
    expect(erro.code).toBe('MEDICO_NAO_ENCONTRADO');
    expect(await Consulta.countDocuments()).toBe(0);
  });

  it('paciente inexistente → 404 PACIENTE_NAO_ENCONTRADO (AC 4)', async () => {
    const erro = await erroDe(criarConsulta(nova({ pacienteId: 'PAC9999' }), AGORA));
    expect(erro.status).toBe(404);
    expect(erro.code).toBe('PACIENTE_NAO_ENCONTRADO');
  });

  it('início fora do minuto 00/30 → 422 FORA_DO_SLOT (AC 5)', async () => {
    const erro = await erroDe(criarConsulta(nova({ inicio: emSaoPaulo('2026-10-12T09:15') }), AGORA));
    expect(erro.status).toBe(422);
    expect(erro.code).toBe('FORA_DO_SLOT');
  });

  it('início com segundos → 422 FORA_DO_SLOT (AC 5)', async () => {
    const erro = await erroDe(criarConsulta(nova({ inicio: new Date('2026-10-12T09:00:30-03:00') }), AGORA));
    expect(erro.status).toBe(422);
    expect(erro.code).toBe('FORA_DO_SLOT');
  });

  it('terminando depois do fim da grade → 422 FORA_DA_GRADE (AC 6)', async () => {
    const erro = await erroDe(criarConsulta(nova({ inicio: emSaoPaulo('2026-10-12T12:00') }), AGORA));
    expect(erro.status).toBe(422);
    expect(erro.code).toBe('FORA_DA_GRADE');
  });

  it('dia da semana sem grade → 422 FORA_DA_GRADE (AC 6)', async () => {
    const erro = await erroDe(criarConsulta(nova({ inicio: emSaoPaulo('2026-10-13T09:00') }), AGORA));
    expect(erro.status).toBe(422);
    expect(erro.code).toBe('FORA_DA_GRADE');
  });

  it('início igual a agora → 422 HORARIO_PASSADO (AC 7)', async () => {
    const erro = await erroDe(criarConsulta(nova({ inicio: AGORA }), AGORA));
    expect(erro.status).toBe(422);
    expect(erro.code).toBe('HORARIO_PASSADO');
  });

  it('slot de hoje que já passou → 422 HORARIO_PASSADO (AC 7, edge case)', async () => {
    const erro = await erroDe(criarConsulta(nova({ inicio: emSaoPaulo('2026-10-12T07:30') }), AGORA));
    expect(erro.status).toBe(422);
    expect(erro.code).toBe('HORARIO_PASSADO');
  });

  it('médico com consulta no mesmo início → 409 com o nome do médico e a hora (AC 8)', async () => {
    await existente('MED01', 'PAC0002', emSaoPaulo('2026-10-12T09:00'), 'confirmada');

    const erro = await erroDe(criarConsulta(nova(), AGORA));
    expect(erro.status).toBe(409);
    expect(erro.code).toBe('HORARIO_OCUPADO');
    expect(erro.message).toBe('Dr. Paulo Mendes já tem consulta às 09:00 neste dia.');
    expect(await Consulta.countDocuments()).toBe(1);
  });

  it('paciente com consulta no mesmo início com outro médico → 409 com o nome do paciente (AC 9)', async () => {
    await existente('MED02', 'PAC0001', emSaoPaulo('2026-10-12T09:30'), 'agendada');

    const erro = await erroDe(criarConsulta(nova({ inicio: emSaoPaulo('2026-10-12T09:30') }), AGORA));
    expect(erro.status).toBe(409);
    expect(erro.code).toBe('HORARIO_OCUPADO');
    expect(erro.message).toBe('Maria Silva já tem consulta às 09:30 neste dia.');
  });

  it('só consulta cancelada no horário → aceita (AC 10)', async () => {
    await existente('MED01', 'PAC0001', emSaoPaulo('2026-10-12T09:00'), 'cancelada_paciente');
    await existente('MED01', 'PAC0002', emSaoPaulo('2026-10-12T09:00'), 'cancelada_clinica');

    const consulta = await criarConsulta(nova(), AGORA);
    expect(consulta.status).toBe('agendada');
    expect(await Consulta.countDocuments({ status: 'agendada' })).toBe(1);
  });

  it('duas criações concorrentes no mesmo slot gravam só uma (AC 11)', async () => {
    const resultados = await Promise.allSettled([
      criarConsulta(nova(), AGORA),
      criarConsulta(nova({ pacienteId: 'PAC0002' }), AGORA),
    ]);

    const cumpridas = resultados.filter((r) => r.status === 'fulfilled');
    const rejeitadas = resultados.filter((r) => r.status === 'rejected');
    expect(cumpridas).toHaveLength(1);
    expect(rejeitadas).toHaveLength(1);
    const motivo: unknown = rejeitadas[0]?.status === 'rejected' ? rejeitadas[0].reason : null;
    expect(motivo).toBeInstanceOf(HttpError);
    expect(motivo instanceof HttpError && motivo.code).toBe('HORARIO_OCUPADO');
    expect(await Consulta.countDocuments()).toBe(1);
  });
});

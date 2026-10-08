import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { diaSeguinte, inicioDoDia, partesEmSaoPaulo } from '../../src/fuso';
import { Consulta, type DadosConsulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// A rota usa o relógio real. Conjunto conhecido, com datas que não dependem da hora em que o teste roda:
// - hoje 00:30 realizada e hoje 23:30 cancelada (status finais: só entram em "hoje" e "todas");
// - 2099 agendada/confirmada (sempre "próximas"); 2020 agendada/confirmada (sempre "aguardando").
const hoje = partesEmSaoPaulo(new Date()).data;
const MEIA_HORA = 30 * 60_000;

const INICIOS = {
  hojeCedo: new Date(inicioDoDia(hoje).getTime() + MEIA_HORA),
  hojeTarde: new Date(inicioDoDia(diaSeguinte(hoje)).getTime() - MEIA_HORA),
  futuro1: new Date('2099-01-05T09:00:00-03:00'),
  futuro2: new Date('2099-01-12T09:00:00-03:00'),
  passado1: new Date('2020-01-06T09:00:00-03:00'),
  passado2: new Date('2020-01-13T09:00:00-03:00'),
  passado3: new Date('2020-01-20T10:00:00-03:00'),
  passado0: new Date('2019-12-30T09:00:00-03:00'),
};
type Nome = keyof typeof INICIOS;

const MARCADA_EM = new Date('2019-12-01T10:00:00-03:00');

// nome → [paciente, médico, status, código legado]
const CONSULTAS: Record<Nome, [string, string, DadosConsulta['status'], string | null]> = {
  hojeCedo: ['PAC0003', 'MED02', 'realizada', null],
  hojeTarde: ['PAC0002', 'MED01', 'cancelada_clinica', null],
  futuro1: ['PAC0002', 'MED01', 'agendada', null],
  futuro2: ['PAC0001', 'MED02', 'confirmada', null],
  passado1: ['PAC0001', 'MED01', 'agendada', null],
  passado2: ['PAC0003', 'MED02', 'confirmada', null],
  passado3: ['PAC0002', 'MED01', 'falta', 'AG00001'],
  passado0: ['PAC0001', 'MED01', 'cancelada_paciente', null],
};

// id gerado de cada consulta, para comparar as listas pelo nome.
const ids = {} as Record<Nome, string>;

async function listar(query: string) {
  return request(app).get(`/api/consultas?${query}`);
}

function nomesDe(itens: { id: string }[]): Nome[] {
  const porId = new Map(Object.entries(ids).map(([nome, id]) => [id, nome as Nome]));
  return itens.map((item) => porId.get(item.id) ?? (item.id as Nome));
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_consultas_listar');
  await Promise.all([Medico.init(), Paciente.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create([
    { _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] },
    { _id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia', grade: [] },
  ]);
  await Paciente.create([
    { _id: 'PAC0001', nome: 'João Pedro', telefone: '53948954499' },
    { _id: 'PAC0002', nome: 'Maria Conceição', telefone: null },
    { _id: 'PAC0003', nome: 'Ana Costa', telefone: '5132221111' },
  ]);
  for (const [nome, [pacienteId, medicoId, status, codigoLegado]] of Object.entries(CONSULTAS)) {
    const consulta = await Consulta.create({
      codigoLegado,
      pacienteId,
      medicoId,
      tipoAtendimento: 'convenio',
      inicio: INICIOS[nome as Nome],
      marcadaEm: MARCADA_EM,
      canceladaEm: null,
      status,
    });
    ids[nome as Nome] = String(consulta._id);
  }
});

afterAll(async () => {
  await desconectar();
});

describe('GET /api/consultas — abas (AC 2, ordem do design)', () => {
  it('hoje: início no dia de hoje, qualquer status, início crescente', async () => {
    const res = await listar('aba=hoje');

    expect(res.status).toBe(200);
    expect(nomesDe(res.body.itens)).toEqual(['hojeCedo', 'hojeTarde']);
    expect(res.body).toMatchObject({ total: 2, pagina: 1, porPagina: 10 });
  });

  it('próximas: início a partir de agora, agendada/confirmada, início crescente', async () => {
    const res = await listar('aba=proximas');

    expect(nomesDe(res.body.itens)).toEqual(['futuro1', 'futuro2']);
    expect(res.body.total).toBe(2);
  });

  it('aguardando: início antes de agora, agendada/confirmada, início decrescente', async () => {
    const res = await listar('aba=aguardando');

    expect(nomesDe(res.body.itens)).toEqual(['passado2', 'passado1']);
    expect(res.body.total).toBe(2);
  });

  it('todas: sem corte de tempo, início decrescente', async () => {
    const res = await listar('aba=todas');

    expect(nomesDe(res.body.itens)).toEqual([
      'futuro2',
      'futuro1',
      'hojeTarde',
      'hojeCedo',
      'passado3',
      'passado2',
      'passado1',
      'passado0',
    ]);
    expect(res.body.total).toBe(8);
  });
});

describe('GET /api/consultas — itens (AC 1)', () => {
  it('traz paciente, primeira consulta, médico, tipo, marcação, início, status e código', async () => {
    const res = await listar('aba=todas');
    const porNome = new Map(nomesDe(res.body.itens).map((nome, i) => [nome, res.body.itens[i]]));

    expect(porNome.get('passado3')).toEqual({
      id: ids.passado3,
      codigo: 'AG00001',
      paciente: { id: 'PAC0002', nome: 'Maria Conceição', telefone: null },
      primeiraConsulta: true,
      medico: { id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia' },
      tipoAtendimento: 'convenio',
      marcadaEm: MARCADA_EM.toISOString(),
      inicio: INICIOS.passado3.toISOString(),
      status: 'falta',
    });
    // Sem código legado: os 6 últimos caracteres do id.
    expect(porNome.get('futuro2')).toEqual({
      id: ids.futuro2,
      codigo: ids.futuro2.slice(-6),
      paciente: { id: 'PAC0001', nome: 'João Pedro', telefone: '53948954499' },
      primeiraConsulta: false,
      medico: { id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia' },
      tipoAtendimento: 'convenio',
      marcadaEm: MARCADA_EM.toISOString(),
      inicio: INICIOS.futuro2.toISOString(),
      status: 'confirmada',
    });
  });

  it('primeira consulta = a de menor início do paciente entre as não canceladas', async () => {
    const res = await listar('aba=todas');
    const primeiras = nomesDe(res.body.itens.filter((item: { primeiraConsulta: boolean }) => item.primeiraConsulta));

    // PAC0001: passado0 é cancelada, então a primeira é passado1. PAC0002: passado3. PAC0003: passado2.
    expect(primeiras.sort()).toEqual(['passado1', 'passado2', 'passado3']);
  });
});

describe('GET /api/consultas — filtros (AC 3)', () => {
  it('busca por trecho do nome sem diferenciar maiúsculas e acentos', async () => {
    const joao = await listar('aba=todas&busca=joao');
    expect(nomesDe(joao.body.itens)).toEqual(['futuro2', 'passado1', 'passado0']);

    const conceicao = await listar('aba=todas&busca=CONCEICAO');
    expect(nomesDe(conceicao.body.itens)).toEqual(['futuro1', 'hojeTarde', 'passado3']);
  });

  it('busca sem paciente encontrado → lista vazia', async () => {
    const res = await listar('aba=todas&busca=zzz');
    expect(res.body).toEqual({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  });

  it('status', async () => {
    const res = await listar('aba=todas&status=agendada');
    expect(nomesDe(res.body.itens)).toEqual(['futuro1', 'passado1']);

    const proximas = await listar('aba=proximas&status=confirmada');
    expect(nomesDe(proximas.body.itens)).toEqual(['futuro2']);
  });

  it('médico', async () => {
    const res = await listar('aba=todas&medicoId=MED02');
    expect(nomesDe(res.body.itens)).toEqual(['futuro2', 'hojeCedo', 'passado2']);
  });

  it('período por dia de início, inclusive nas duas pontas, na aba todas', async () => {
    const res = await listar('aba=todas&de=2020-01-06&ate=2020-01-13');
    expect(nomesDe(res.body.itens)).toEqual(['passado2', 'passado1']);
  });

  it('período não vale nas outras abas', async () => {
    const res = await listar('aba=proximas&de=2020-01-06&ate=2020-01-13');
    expect(nomesDe(res.body.itens)).toEqual(['futuro1', 'futuro2']);
  });

  it('filtros combinados', async () => {
    const res = await listar('aba=todas&busca=joao&medicoId=MED01&status=agendada');
    expect(nomesDe(res.body.itens)).toEqual(['passado1']);
  });
});

describe('GET /api/consultas — paginação', () => {
  it('página 2 com 3 por página', async () => {
    const res = await listar('aba=todas&pagina=2&porPagina=3');

    expect(nomesDe(res.body.itens)).toEqual(['hojeCedo', 'passado3', 'passado2']);
    expect(res.body).toMatchObject({ total: 8, pagina: 2, porPagina: 3 });
  });

  it('página além do total → itens vazio com o total correto (edge case)', async () => {
    const res = await listar('aba=todas&pagina=4&porPagina=3');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ itens: [], total: 8, pagina: 4, porPagina: 3 });
  });
});

describe('GET /api/consultas/contagens (AC 4)', () => {
  it('total de cada aba, igual ao total da lista', async () => {
    const res = await request(app).get('/api/consultas/contagens');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hoje: 2, proximas: 2, aguardando: 2, todas: 8 });
    for (const aba of ['hoje', 'proximas', 'aguardando', 'todas'] as const) {
      expect((await listar(`aba=${aba}`)).body.total).toBe(res.body[aba]);
    }
  });

  it('com os mesmos filtros (período só na aba todas)', async () => {
    const busca = await request(app).get('/api/consultas/contagens?busca=joao');
    expect(busca.body).toEqual({ hoje: 0, proximas: 1, aguardando: 1, todas: 3 });

    const periodo = await request(app).get('/api/consultas/contagens?de=2020-01-06&ate=2020-01-13');
    expect(periodo.body).toEqual({ hoje: 2, proximas: 2, aguardando: 2, todas: 2 });

    const medico = await request(app).get('/api/consultas/contagens?medicoId=MED01&status=agendada');
    expect(medico.body).toEqual({ hoje: 0, proximas: 1, aguardando: 1, todas: 2 });
  });
});

describe('filtros inválidos → 400 FILTRO_INVALIDO (AC 7)', () => {
  it.each([
    ['aba desconhecida', 'aba=ontem'],
    ['de inválido', 'aba=todas&de=2020-02-30'],
    ['ate inválido', 'aba=todas&ate=lixo'],
    ['de depois de ate', 'aba=todas&de=2020-01-13&ate=2020-01-06'],
    ['status desconhecido', 'aba=todas&status=remarcada'],
  ])('lista: %s', async (_caso, query) => {
    const res = await listar(query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'FILTRO_INVALIDO', message: expect.any(String) } });
  });

  it('contagens: de depois de ate', async () => {
    const res = await request(app).get('/api/consultas/contagens?de=2020-01-13&ate=2020-01-06');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILTRO_INVALIDO');
  });
});

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { diaSeguinte, partesEmSaoPaulo } from '../../src/fuso';
import { Consulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { CORTES, PESOS } from '../../src/risco/pesos';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

// A rota usa o relógio real: as consultas ficam 3 dias à frente, às 14:00 de São Paulo.
let diaDaConsulta = partesEmSaoPaulo(new Date()).data;
for (let i = 0; i < 3; i++) {
  diaDaConsulta = diaSeguinte(diaDaConsulta);
}
const INICIO = new Date(`${diaDaConsulta}T14:00:00-03:00`);

beforeAll(async () => {
  await conectarBancoDeTeste('routes_prevencao');
  await Promise.all([Medico.init(), Paciente.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
  await Medico.create({ _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] });
  await Paciente.create({ _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' });
  // Primeira consulta (25) + convênio (15) = 40: média.
  await Consulta.create({
    pacienteId: 'PAC0001',
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio: INICIO,
    status: 'confirmada',
  });
});

afterAll(async () => {
  await desconectar();
});

describe('GET /api/prevencao-de-faltas', () => {
  it('200 com a lista paginada', async () => {
    const res = await request(app).get('/api/prevencao-de-faltas');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, pagina: 1, porPagina: 10 });
    expect(res.body.itens).toHaveLength(1);
    expect(res.body.itens[0]).toMatchObject({
      paciente: { id: 'PAC0001', nome: 'Maria Silva' },
      status: 'confirmada',
      faltoso: false,
      risco: { pontos: 40, nivel: 'media' },
    });
  });

  it('filtra pelo nível', async () => {
    const media = await request(app).get('/api/prevencao-de-faltas?nivel=media');
    const alta = await request(app).get('/api/prevencao-de-faltas?nivel=alta');
    expect(media.body.total).toBe(1);
    expect(alta.status).toBe(200);
    expect(alta.body.total).toBe(0);
  });

  it('400 FILTRO_INVALIDO para nível inválido', async () => {
    const res = await request(app).get('/api/prevencao-de-faltas?nivel=baixo');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILTRO_INVALIDO');
  });

  it('400 PAGINACAO_INVALIDA para página inválida', async () => {
    const res = await request(app).get('/api/prevencao-de-faltas?pagina=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAGINACAO_INVALIDA');
  });
});

describe('GET /api/prevencao-de-faltas/regras', () => {
  it('devolve pesos, cortes e rótulos da fonte única', async () => {
    const res = await request(app).get('/api/prevencao-de-faltas/regras');
    expect(res.status).toBe(200);
    expect(res.body.pesos).toEqual(PESOS);
    expect(res.body.cortes).toEqual(CORTES);
    expect(res.body.fatores).toHaveLength(5);
    expect(res.body.fatores[0]).toMatchObject({ codigo: 'historico', pontos: 40 });
    expect(typeof res.body.fatores[0].rotulo).toBe('string');
  });
});

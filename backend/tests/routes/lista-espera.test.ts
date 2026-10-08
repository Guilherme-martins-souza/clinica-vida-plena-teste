import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { ListaEspera } from '../../src/models/lista-espera';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

beforeAll(async () => {
  await conectarBancoDeTeste('routes_lista_espera');
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('POST /api/lista-espera', () => {
  it('201 grava a pessoa com data de cadastro e os padrões', async () => {
    const antes = Date.now();
    const res = await request(app).post('/api/lista-espera').send({ nome: 'Ana Lima', telefone: '53948954499' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nome: 'Ana Lima', telefone: '53948954499', medicoId: null, antecipar: false });
    expect(new Date(res.body.criadoEm).getTime()).toBeGreaterThanOrEqual(antes);
    expect(await ListaEspera.countDocuments()).toBe(1);
  });

  it('201 com médico, antecipar e telefone de 10 dígitos', async () => {
    const res = await request(app)
      .post('/api/lista-espera')
      .send({ nome: 'Rui Alves', telefone: '5332221111', medicoId: 'MED01', antecipar: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ medicoId: 'MED01', antecipar: true });
  });

  it.each([
    [{}],
    [{ telefone: '53948954499' }],
    [{ nome: 'Ana' }],
    [{ nome: '   ', telefone: '53948954499' }],
    [{ nome: 'Ana', telefone: '123' }],
    [{ nome: 'Ana', telefone: '(53) 94895-4499' }],
    [{ nome: 'Ana', telefone: '53948954499', antecipar: 'sim' }],
  ])('400 DADOS_INVALIDOS para %j', async (corpo) => {
    const res = await request(app).post('/api/lista-espera').send(corpo);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DADOS_INVALIDOS');
    expect(await ListaEspera.countDocuments()).toBe(0);
  });
});

describe('GET /api/lista-espera', () => {
  it('paginada de 10 em 10, da mais antiga para a mais nova', async () => {
    const pessoas = Array.from({ length: 12 }, (_, i) => ({
      nome: `Pessoa ${String(i + 1).padStart(2, '0')}`,
      telefone: '11955550000',
      criadoEm: new Date(Date.UTC(2026, 9, 1, 10, i)),
    }));
    await ListaEspera.create(pessoas);

    const pagina1 = await request(app).get('/api/lista-espera');
    expect(pagina1.status).toBe(200);
    expect(pagina1.body).toMatchObject({ total: 12, pagina: 1, porPagina: 10 });
    expect(pagina1.body.itens).toHaveLength(10);
    expect(pagina1.body.itens[0].nome).toBe('Pessoa 01');

    const pagina2 = await request(app).get('/api/lista-espera?pagina=2');
    expect(pagina2.body.itens.map((p: { nome: string }) => p.nome)).toEqual(['Pessoa 11', 'Pessoa 12']);
  });

  it('400 PAGINACAO_INVALIDA', async () => {
    const res = await request(app).get('/api/lista-espera?pagina=0');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAGINACAO_INVALIDA');
  });
});

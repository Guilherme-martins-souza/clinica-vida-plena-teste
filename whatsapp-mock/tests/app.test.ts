import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { limparMensagens } from '../src/mensagens';

const valida = { to: '5511999990001', tipo: 'confirmacao', text: 'Olá paciente' };

describe('POST /messages', () => {
  beforeEach(limparMensagens);

  it('responde 201 com o id', async () => {
    const res = await request(app).post('/messages').send(valida);
    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(String));
  });

  it.each(['to', 'tipo', 'text'])('responde 400 sem %s', async (campo) => {
    const dados: Record<string, string> = { ...valida };
    delete dados[campo];
    const res = await request(app).post('/messages').send(dados);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain(campo);
  });

  it('responde 400 com JSON malformado', async () => {
    const res = await request(app).post('/messages').set('Content-Type', 'application/json').send('{x');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('GET /', () => {
  beforeEach(limparMensagens);

  it('mostra a mensagem enviada', async () => {
    await request(app).post('/messages').send(valida);
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('Olá paciente');
    expect(res.text).toContain('5511999990001');
  });

  it('mostra texto vazio sem mensagens', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('Nenhuma mensagem recebida ainda.');
  });
});

describe('rotas de resposta', () => {
  it('não existem (só POST /messages e GET /)', async () => {
    expect((await request(app).post('/')).status).toBe(404);
    expect((await request(app).get('/messages')).status).toBe(404);
    expect((await request(app).post('/reply').send(valida)).status).toBe(404);
  });
});

describe('GET /?telefone=', () => {
  beforeEach(limparMensagens);

  it('abre o chat do telefone pedido', async () => {
    await request(app)
      .post('/messages')
      .send({ ...valida, text: 'Para o primeiro' });
    await request(app)
      .post('/messages')
      .send({ ...valida, to: '5511999990002', text: 'Para o segundo' });
    const res = await request(app).get('/?telefone=5511999990001');
    expect(res.text).toContain('<h2>5511999990001</h2>');
    expect(res.text).toContain('Para o primeiro');
    expect(res.text).not.toContain('<h2>5511999990002</h2>');
  });
});

describe('GET /?q=', () => {
  beforeEach(limparMensagens);

  it('filtra os chats pelo número buscado', async () => {
    await request(app).post('/messages').send(valida);
    await request(app)
      .post('/messages')
      .send({ ...valida, to: '5511999990002', text: 'Outro paciente' });
    const res = await request(app).get('/?q=0002');
    expect(res.text).toContain('Outro paciente');
    expect(res.text).not.toContain('Olá paciente');
  });
});

describe('GET /status', () => {
  beforeEach(limparMensagens);

  it('devolve quantas mensagens existem', async () => {
    expect((await request(app).get('/status')).body).toEqual({ total: 0 });
    await request(app).post('/messages').send(valida);
    expect((await request(app).get('/status')).body).toEqual({ total: 1 });
  });

  it('a página traz o mesmo total para comparar', async () => {
    await request(app).post('/messages').send(valida);
    expect((await request(app).get('/')).text).toContain('data-total="1"');
  });
});

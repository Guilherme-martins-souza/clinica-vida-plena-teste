import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('GET /api/health', () => {
  it('responde 200 mesmo sem MongoDB conectado', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', mongo: 'disconnected' });
  });
});

describe('rota inexistente', () => {
  it('responde 404 em JSON', async () => {
    const res = await request(app).get('/api/nao-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

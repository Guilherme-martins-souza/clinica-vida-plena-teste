import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app';
import { configurarEnviador } from '../../src/mensagens/enviar';
import { textoConfirmacao, textoLembrete } from '../../src/mensagens/textos';
import { Consulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const INICIO = new Date('2026-10-12T12:00:00Z');
const enviador = vi.fn();

async function criarConsulta(pacienteId: string): Promise<string> {
  const consulta = await Consulta.create({
    pacienteId,
    medicoId: 'MED01',
    tipoAtendimento: 'particular',
    inicio: INICIO,
    status: 'agendada',
  });
  return String(consulta._id);
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_consultas_mensagens');
});

beforeEach(async () => {
  await limparBanco();
  enviador.mockReset().mockResolvedValue(undefined);
  configurarEnviador(enviador);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await Medico.create({ _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] });
  await Paciente.create([
    { _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' },
    { _id: 'PAC0002', nome: 'João Souza', telefone: null },
  ]);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await desconectar();
});

describe('POST /api/consultas/:id/mensagens', () => {
  const dados = { paciente: 'Maria Silva', medico: 'Dr. Paulo Mendes', inicio: INICIO };

  it('200 e envia a confirmação (mensagem 2)', async () => {
    const id = await criarConsulta('PAC0001');
    const res = await request(app).post(`/api/consultas/${id}/mensagens`).send({ tipo: 'confirmacao' });

    expect(res.status).toBe(200);
    expect(enviador).toHaveBeenCalledWith({
      to: '53948954499',
      tipo: 'confirmacao',
      text: textoConfirmacao(dados),
    });
  });

  it('200 e envia o lembrete (mensagem 3); reenvio é permitido', async () => {
    const id = await criarConsulta('PAC0001');
    const url = `/api/consultas/${id}/mensagens`;

    expect((await request(app).post(url).send({ tipo: 'lembrete' })).status).toBe(200);
    expect((await request(app).post(url).send({ tipo: 'lembrete' })).status).toBe(200);
    expect(enviador).toHaveBeenCalledTimes(2);
    expect(enviador).toHaveBeenLastCalledWith({ to: '53948954499', tipo: 'lembrete', text: textoLembrete(dados) });
  });

  it.each([[{}], [{ tipo: 'criada' }], [{ tipo: 'outro' }]])('400 DADOS_INVALIDOS para %j', async (corpo) => {
    const id = await criarConsulta('PAC0001');
    const res = await request(app).post(`/api/consultas/${id}/mensagens`).send(corpo);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DADOS_INVALIDOS');
    expect(enviador).not.toHaveBeenCalled();
  });

  it('404 CONSULTA_NAO_ENCONTRADA', async () => {
    const res = await request(app)
      .post('/api/consultas/000000000000000000000000/mensagens')
      .send({ tipo: 'confirmacao' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONSULTA_NAO_ENCONTRADA');
  });

  it('422 SEM_TELEFONE', async () => {
    const id = await criarConsulta('PAC0002');
    const res = await request(app).post(`/api/consultas/${id}/mensagens`).send({ tipo: 'confirmacao' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SEM_TELEFONE');
  });

  it('502 MENSAGEM_NAO_ENVIADA quando o mock está fora do ar', async () => {
    const id = await criarConsulta('PAC0001');
    enviador.mockRejectedValue(new Error('fora do ar'));
    const res = await request(app).post(`/api/consultas/${id}/mensagens`).send({ tipo: 'confirmacao' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('MENSAGEM_NAO_ENVIADA');
  });
});

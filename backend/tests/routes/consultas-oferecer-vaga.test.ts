import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app';
import { configurarEnviador } from '../../src/mensagens/enviar';
import { textoVaga } from '../../src/mensagens/textos';
import { Consulta } from '../../src/models/consulta';
import { ListaEspera } from '../../src/models/lista-espera';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const INICIO = new Date('2026-10-12T12:00:00Z');
const enviador = vi.fn();

async function criarConsulta(medicoId = 'MED01'): Promise<string> {
  const consulta = await Consulta.create({
    pacienteId: 'PAC0001',
    medicoId,
    tipoAtendimento: 'particular',
    inicio: INICIO,
    status: 'agendada',
  });
  return String(consulta._id);
}

beforeAll(async () => {
  await conectarBancoDeTeste('routes_consultas_oferecer_vaga');
});

beforeEach(async () => {
  await limparBanco();
  enviador.mockReset().mockResolvedValue(undefined);
  configurarEnviador(enviador);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await Medico.create([
    { _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] },
    { _id: 'MED02', nome: 'Dra. Lúcia Prado', especialidade: 'Pediatria', grade: [] },
  ]);
  await Paciente.create({ _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await desconectar();
});

describe('POST /api/consultas/:id/oferecer-vaga', () => {
  it('200 e envia a mensagem 4 ao telefone da pessoa mais antiga elegível da espera', async () => {
    await ListaEspera.create([
      { nome: 'Outro médico', telefone: '11911110000', medicoId: 'MED02', criadoEm: new Date('2026-10-01T10:00:00Z') },
      { nome: 'Mais nova', telefone: '11922220000', medicoId: null, criadoEm: new Date('2026-10-03T10:00:00Z') },
      { nome: 'Mais antiga', telefone: '11933330000', medicoId: 'MED01', criadoEm: new Date('2026-10-02T10:00:00Z') },
    ]);
    const id = await criarConsulta();

    const res = await request(app).post(`/api/consultas/${id}/oferecer-vaga`);

    expect(res.status).toBe(200);
    expect(enviador).toHaveBeenCalledTimes(1);
    expect(enviador).toHaveBeenCalledWith({
      to: '11933330000',
      tipo: 'vaga',
      text: textoVaga({ paciente: 'Mais antiga', medico: 'Dr. Paulo Mendes', inicio: INICIO }),
    });
  });

  it('a consulta e a lista de espera ficam iguais', async () => {
    await ListaEspera.create({ nome: 'Ana', telefone: '11933330000' });
    const id = await criarConsulta();
    const consultaAntes = await Consulta.findById(id).lean();
    const esperaAntes = await ListaEspera.find().lean();

    await request(app).post(`/api/consultas/${id}/oferecer-vaga`);

    expect(await Consulta.findById(id).lean()).toEqual(consultaAntes);
    expect(await ListaEspera.find().lean()).toEqual(esperaAntes);
  });

  it('404 SEM_LISTA_DE_ESPERA quando ninguém é elegível', async () => {
    await ListaEspera.create({ nome: 'Outro médico', telefone: '11911110000', medicoId: 'MED02' });
    const id = await criarConsulta();

    const res = await request(app).post(`/api/consultas/${id}/oferecer-vaga`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SEM_LISTA_DE_ESPERA');
    expect(enviador).not.toHaveBeenCalled();
  });

  it('404 CONSULTA_NAO_ENCONTRADA', async () => {
    const res = await request(app).post('/api/consultas/000000000000000000000000/oferecer-vaga');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONSULTA_NAO_ENCONTRADA');
  });

  it('502 MENSAGEM_NAO_ENVIADA quando o mock está fora do ar', async () => {
    await ListaEspera.create({ nome: 'Ana', telefone: '11933330000' });
    const id = await criarConsulta();
    enviador.mockRejectedValue(new Error('fora do ar'));

    const res = await request(app).post(`/api/consultas/${id}/oferecer-vaga`);

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('MENSAGEM_NAO_ENVIADA');
  });
});

describe('POST /api/consultas/:id/oferecer-vaga com listaEsperaId', () => {
  it('200 e envia a mensagem 4 à pessoa escolhida, mesmo não sendo a mais antiga', async () => {
    const [, escolhida] = await ListaEspera.create([
      { nome: 'Mais antiga', telefone: '11933330000', medicoId: 'MED01', criadoEm: new Date('2026-10-01T10:00:00Z') },
      { nome: 'Escolhida', telefone: '11944440000', medicoId: 'MED01', criadoEm: new Date('2026-10-02T10:00:00Z') },
    ]);
    const id = await criarConsulta();

    const res = await request(app)
      .post(`/api/consultas/${id}/oferecer-vaga`)
      .send({ listaEsperaId: String(escolhida._id) });

    expect(res.status).toBe(200);
    expect(enviador).toHaveBeenCalledTimes(1);
    expect(enviador).toHaveBeenCalledWith({
      to: '11944440000',
      tipo: 'vaga',
      text: textoVaga({ paciente: 'Escolhida', medico: 'Dr. Paulo Mendes', inicio: INICIO }),
    });
  });

  it('422 PESSOA_DE_OUTRO_MEDICO quando a pessoa pediu outro médico ou qualquer um', async () => {
    const [outro, qualquer] = await ListaEspera.create([
      { nome: 'Outro médico', telefone: '11911110000', medicoId: 'MED02' },
      { nome: 'Qualquer', telefone: '11922220000', medicoId: null },
    ]);
    const id = await criarConsulta();

    for (const pessoa of [outro, qualquer]) {
      const res = await request(app)
        .post(`/api/consultas/${id}/oferecer-vaga`)
        .send({ listaEsperaId: String(pessoa._id) });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PESSOA_DE_OUTRO_MEDICO');
    }
    expect(enviador).not.toHaveBeenCalled();
  });

  it.each(['000000000000000000000000', 'nao-e-um-id'])(
    '404 PESSOA_NAO_ENCONTRADA para o id %s',
    async (listaEsperaId) => {
      const id = await criarConsulta();

      const res = await request(app).post(`/api/consultas/${id}/oferecer-vaga`).send({ listaEsperaId });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PESSOA_NAO_ENCONTRADA');
      expect(enviador).not.toHaveBeenCalled();
    },
  );
});

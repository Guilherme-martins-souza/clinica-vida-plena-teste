import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configurarEnviador, enviarMensagem } from '../../src/mensagens/enviar';
import { textoConfirmacao, textoCriada, textoLembrete } from '../../src/mensagens/textos';
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
  await conectarBancoDeTeste('mensagens_enviar');
});

beforeEach(async () => {
  await limparBanco();
  enviador.mockReset().mockResolvedValue(undefined);
  configurarEnviador(enviador);
  await Medico.create({ _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] });
  await Paciente.create([
    { _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' },
    { _id: 'PAC0002', nome: 'João Souza', telefone: null },
  ]);
});

afterAll(async () => {
  await desconectar();
});

describe('enviarMensagem', () => {
  it.each([
    ['criada', textoCriada],
    ['confirmacao', textoConfirmacao],
    ['lembrete', textoLembrete],
  ] as const)('envia a mensagem %s ao telefone do paciente com o texto certo', async (tipo, texto) => {
    const id = await criarConsulta('PAC0001');

    await enviarMensagem(id, tipo);

    expect(enviador).toHaveBeenCalledWith({
      to: '53948954499',
      tipo,
      text: texto({ paciente: 'Maria Silva', medico: 'Dr. Paulo Mendes', inicio: INICIO }),
    });
  });

  it('404 CONSULTA_NAO_ENCONTRADA', async () => {
    await expect(enviarMensagem('000000000000000000000000', 'criada')).rejects.toMatchObject({
      status: 404,
      code: 'CONSULTA_NAO_ENCONTRADA',
    });
  });

  it('422 SEM_TELEFONE e não chama o enviador', async () => {
    const id = await criarConsulta('PAC0002');
    await expect(enviarMensagem(id, 'criada')).rejects.toMatchObject({ status: 422, code: 'SEM_TELEFONE' });
    expect(enviador).not.toHaveBeenCalled();
  });

  it('falha do enviador vira 502 MENSAGEM_NAO_ENVIADA', async () => {
    const id = await criarConsulta('PAC0001');
    enviador.mockRejectedValue(new Error('fora do ar'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(enviarMensagem(id, 'criada')).rejects.toMatchObject({ status: 502, code: 'MENSAGEM_NAO_ENVIADA' });
    log.mockRestore();
  });
});

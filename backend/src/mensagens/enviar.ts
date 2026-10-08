import { HttpError } from '../errors';
import { proximaDaEspera } from '../lista-espera/proxima';
import { Consulta } from '../models/consulta';
import { Medico } from '../models/medico';
import { Paciente } from '../models/paciente';
import type { Enviador, TipoMensagem } from './cliente-whatsapp';
import { textoConfirmacao, textoCriada, textoLembrete, textoVaga } from './textos';

const TEXTOS = {
  criada: textoCriada,
  confirmacao: textoConfirmacao,
  lembrete: textoLembrete,
};

// Sem configurarEnviador (sem WHATSAPP_URL), todo envio falha.
let enviador: Enviador = async () => {
  throw new Error('WHATSAPP_URL não configurada');
};

export function configurarEnviador(novo: Enviador): void {
  enviador = novo;
}

// Monta o texto do tipo e envia ao telefone do paciente.
export async function enviarMensagem(consultaId: string, tipo: Exclude<TipoMensagem, 'vaga'>): Promise<void> {
  const consulta = await Consulta.findById(consultaId);
  if (!consulta) {
    throw new HttpError(404, 'CONSULTA_NAO_ENCONTRADA', 'Consulta não encontrada.');
  }
  const [paciente, medico] = await Promise.all([
    Paciente.findById(consulta.pacienteId),
    Medico.findById(consulta.medicoId),
  ]);
  if (!paciente?.telefone) {
    throw new HttpError(422, 'SEM_TELEFONE', 'O paciente não tem telefone cadastrado.');
  }

  const text = TEXTOS[tipo]({
    paciente: paciente.nome,
    medico: medico?.nome ?? 'a clínica',
    inicio: consulta.inicio,
  });
  try {
    await enviador({ to: paciente.telefone, tipo, text });
  } catch (err) {
    console.error('Falha ao enviar mensagem:', err);
    throw new HttpError(502, 'MENSAGEM_NAO_ENVIADA', 'Não foi possível enviar a mensagem. Tente novamente.');
  }
}

// Mensagem 4: oferece o horário desta consulta à pessoa mais antiga da lista de espera do mesmo médico (ou sem médico).
// Não altera a consulta nem a lista de espera.
export async function oferecerVaga(consultaId: string): Promise<void> {
  const consulta = await Consulta.findById(consultaId);
  if (!consulta) {
    throw new HttpError(404, 'CONSULTA_NAO_ENCONTRADA', 'Consulta não encontrada.');
  }
  const [pessoa, medico] = await Promise.all([proximaDaEspera(consulta.medicoId), Medico.findById(consulta.medicoId)]);
  if (!pessoa) {
    throw new HttpError(404, 'SEM_LISTA_DE_ESPERA', 'Não há ninguém na lista de espera para este médico.');
  }

  const text = textoVaga({ paciente: pessoa.nome, medico: medico?.nome ?? 'a clínica', inicio: consulta.inicio });
  try {
    await enviador({ to: pessoa.telefone, tipo: 'vaga', text });
  } catch (err) {
    console.error('Falha ao enviar mensagem:', err);
    throw new HttpError(502, 'MENSAGEM_NAO_ENVIADA', 'Não foi possível enviar a mensagem. Tente novamente.');
  }
}

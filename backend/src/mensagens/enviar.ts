import { HttpError } from '../errors';
import { Consulta } from '../models/consulta';
import { Medico } from '../models/medico';
import { Paciente } from '../models/paciente';
import type { Enviador, TipoMensagem } from './cliente-whatsapp';
import { textoConfirmacao, textoCriada, textoLembrete } from './textos';

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
export async function enviarMensagem(consultaId: string, tipo: TipoMensagem): Promise<void> {
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

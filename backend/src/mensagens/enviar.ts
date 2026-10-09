import { isValidObjectId } from 'mongoose';
import { HttpError } from '../errors';
import { proximaDaEspera } from '../lista-espera/proxima';
import { Consulta } from '../models/consulta';
import { ListaEspera, type DadosListaEspera } from '../models/lista-espera';
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

// A pessoa escolhida na tela: tem que existir e ter pedido exatamente o médico da consulta.
async function buscarEscolhida(pessoaId: string, medicoId: string): Promise<DadosListaEspera> {
  const pessoa = isValidObjectId(pessoaId) ? await ListaEspera.findById(pessoaId).lean() : null;
  if (!pessoa) {
    throw new HttpError(404, 'PESSOA_NAO_ENCONTRADA', 'Pessoa não encontrada na lista de espera.');
  }
  if (pessoa.medicoId !== medicoId) {
    throw new HttpError(422, 'PESSOA_DE_OUTRO_MEDICO', 'Esta pessoa não está na lista de espera deste médico.');
  }
  return pessoa;
}

// Mensagem 4: oferece o horário desta consulta a uma pessoa da lista de espera. Sem `pessoaId`, escolhe a mais antiga
// do mesmo médico (ou sem médico); com `pessoaId`, usa a pessoa que a recepção escolheu (precisa ser deste médico).
// Não altera a consulta nem a lista de espera.
export async function oferecerVaga(consultaId: string, pessoaId?: string): Promise<void> {
  const consulta = await Consulta.findById(consultaId);
  if (!consulta) {
    throw new HttpError(404, 'CONSULTA_NAO_ENCONTRADA', 'Consulta não encontrada.');
  }
  const [pessoa, medico] = await Promise.all([
    pessoaId ? buscarEscolhida(pessoaId, consulta.medicoId) : proximaDaEspera(consulta.medicoId),
    Medico.findById(consulta.medicoId),
  ]);
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

import { isValidObjectId } from 'mongoose';
import { HttpError } from '../errors';
import { Consulta, type StatusConsulta } from '../models/consulta';
import { calcularConsideradoFalta } from './considerado-falta';
import type { ConsultaDoc } from './criar-consulta';
import { validarTransicao } from './transicoes';

// Troca o status de uma consulta (AGD-02). `agora` vem de fora, como em criarConsulta.
export async function alterarStatus(id: string, novo: StatusConsulta, agora: Date): Promise<ConsultaDoc> {
  const consulta = isValidObjectId(id) ? await Consulta.findById(id) : null;
  if (!consulta) {
    throw new HttpError(404, 'CONSULTA_NAO_ENCONTRADA', 'Consulta não encontrada.');
  }

  const erro = validarTransicao(consulta.status, novo, consulta.inicio, agora);
  if (erro) {
    throw new HttpError(422, erro.code, erro.message);
  }

  const cancelando = novo === 'cancelada_paciente' || novo === 'cancelada_clinica';
  const canceladaEm = cancelando ? agora : consulta.canceladaEm;
  const consideradoFalta = calcularConsideradoFalta(novo, consulta.inicio, canceladaEm);
  const mudancas = cancelando ? { status: novo, canceladaEm, consideradoFalta } : { status: novo, consideradoFalta };

  // Só grava se o status ainda é o que foi lido: se outra requisição mudou antes, nada é alterado
  // e o resultado vem nulo (é um documento só, então não precisa de transação).
  const atualizada = await Consulta.findOneAndUpdate(
    { _id: consulta._id, status: consulta.status },
    { $set: mudancas },
    { returnDocument: 'after' },
  );
  if (!atualizada) {
    throw new HttpError(
      409,
      'STATUS_ALTERADO',
      'O status desta consulta foi alterado por outra pessoa. Atualize a lista.',
    );
  }
  return atualizada;
}

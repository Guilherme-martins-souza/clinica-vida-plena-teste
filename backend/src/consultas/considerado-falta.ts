import type { StatusConsulta } from '../models/consulta';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Se a consulta conta como falta (D23): status `falta`, ou cancelamento do paciente a menos de
 * 24 h do início. Sem data de cancelamento (parte do histórico importado), não conta.
 */
export function calcularConsideradoFalta(status: StatusConsulta, inicio: Date, canceladaEm: Date | null): boolean {
  if (status === 'falta') {
    return true;
  }
  if (status === 'cancelada_paciente' && canceladaEm) {
    return inicio.getTime() - canceladaEm.getTime() < UM_DIA_MS;
  }
  return false;
}

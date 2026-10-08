import { Consulta } from '../models/consulta';

// Resumo das consultas já ocorridas de um paciente (FALT-01).
export interface Historico {
  faltas: number; // de todo o histórico
  atendimentos: number; // realizadas + faltas, de todo o histórico
  // Os 5 últimos atendimentos, do mais recente para o mais antigo: true = falta.
  ultimos5: boolean[];
}

const QUANTOS_ULTIMOS = 5;
const TAXA_FALTOSO = 0.25;

// Faltoso: pelo menos 1 atendimento e 25% ou mais de faltas nos 5 últimos.
export function ehFaltoso(historico: Historico): boolean {
  const ultimos = historico.ultimos5.slice(0, QUANTOS_ULTIMOS);
  if (ultimos.length === 0) {
    return false;
  }
  const faltas = ultimos.filter((falta) => falta).length;
  return faltas / ultimos.length >= TAXA_FALTOSO;
}

// Histórico de cada paciente, numa consulta só ao banco. Conta as consultas `realizada` ou
// `consideradoFalta` com início antes de `agora`; a falta é o campo `consideradoFalta`.
// Paciente sem consulta fica com o histórico zerado.
export async function historicoDe(pacienteIds: string[], agora: Date): Promise<Map<string, Historico>> {
  const consultas = await Consulta.find({
    pacienteId: { $in: pacienteIds },
    inicio: { $lt: agora },
    $or: [{ status: 'realizada' }, { consideradoFalta: true }],
  })
    .sort({ inicio: -1, _id: -1 })
    .select('pacienteId consideradoFalta')
    .lean();

  const historicos = new Map<string, Historico>(
    pacienteIds.map((id) => [id, { faltas: 0, atendimentos: 0, ultimos5: [] }]),
  );
  // Do mais recente para o mais antigo: os 5 primeiros de cada paciente são os últimos 5.
  for (const consulta of consultas) {
    const historico = historicos.get(consulta.pacienteId);
    if (!historico) {
      continue;
    }
    historico.atendimentos += 1;
    if (consulta.consideradoFalta) {
      historico.faltas += 1;
    }
    if (historico.ultimos5.length < QUANTOS_ULTIMOS) {
      historico.ultimos5.push(consulta.consideradoFalta);
    }
  }
  return historicos;
}

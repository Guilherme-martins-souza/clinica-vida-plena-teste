import { HttpError } from '../errors';
import { diaSeguinte, inicioDoDia } from '../fuso';
import { Consulta } from '../models/consulta';
import { Medico, type HorarioGrade } from '../models/medico';
import { dentroDaGrade, DURACAO_SLOT_MINUTOS } from './regras';

const SLOTS_POR_DIA = (24 * 60) / DURACAO_SLOT_MINUTOS;

// Inícios de consulta possíveis no dia (AAAA-MM-DD, São Paulo), em ordem: cada :00 e :30 do dia
// que cabe inteiro num horário da grade do médico.
export function slotsDoDia(grade: HorarioGrade[], data: string): Date[] {
  const meiaNoite = inicioDoDia(data).getTime();
  const slots: Date[] = [];
  for (let i = 0; i < SLOTS_POR_DIA; i++) {
    const inicio = new Date(meiaNoite + i * DURACAO_SLOT_MINUTOS * 60_000);
    if (dentroDaGrade(grade, inicio)) {
      slots.push(inicio);
    }
  }
  return slots;
}

export type SituacaoSlot = 'livre' | 'ocupado' | 'passado';

export interface HorariosDoDia {
  data: string;
  slots: { inicio: Date; situacao: SituacaoSlot }[];
  proximoDiaComVaga: string | null; // só quando o dia não tem slot livre
}

// Até quantos dias depois a tela procura uma vaga.
const DIAS_PARA_PROCURAR_VAGA = 60;

// Slots do dia do médico com a situação de cada um (AGD-03). `agora` vem de fora, como nos outros serviços.
export async function horariosDoDia(medicoId: string, data: string, agora: Date): Promise<HorariosDoDia> {
  const medico = await Medico.findById(medicoId).lean();
  if (!medico) {
    throw new HttpError(404, 'MEDICO_NAO_ENCONTRADO', 'Médico não encontrado.');
  }

  // Uma busca só: as consultas ativas do médico do dia pedido até o fim da janela de procura.
  const dias = [data];
  for (let i = 0; i < DIAS_PARA_PROCURAR_VAGA; i++) {
    dias.push(diaSeguinte(dias[dias.length - 1]));
  }
  const consultas = await Consulta.find({
    medicoId,
    inicio: { $gte: inicioDoDia(data), $lt: inicioDoDia(diaSeguinte(dias[dias.length - 1])) },
    status: { $nin: ['cancelada_paciente', 'cancelada_clinica'] },
  })
    .select('inicio')
    .lean();
  const ocupados = new Set(consultas.map((consulta) => consulta.inicio.getTime()));

  // Um slot que já começou é "passado", mesmo que tenha consulta.
  function situacao(inicio: Date): SituacaoSlot {
    if (inicio.getTime() <= agora.getTime()) {
      return 'passado';
    }
    return ocupados.has(inicio.getTime()) ? 'ocupado' : 'livre';
  }

  const slots = slotsDoDia(medico.grade, data).map((inicio) => ({ inicio, situacao: situacao(inicio) }));
  const temVaga = slots.some((slot) => slot.situacao === 'livre');

  const proximoDiaComVaga = temVaga
    ? null
    : (dias.slice(1).find((dia) => slotsDoDia(medico.grade, dia).some((inicio) => situacao(inicio) === 'livre')) ??
      null);

  return { data, slots, proximoDiaComVaga };
}

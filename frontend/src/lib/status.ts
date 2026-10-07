import type { AgendamentoStatus } from '../api/types'

export const STATUS_LABELS: Record<AgendamentoStatus, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  falta: 'Falta',
  cancelada_paciente: 'Cancelada · paciente',
  cancelada_clinica: 'Cancelada · clínica',
}

/** Opções para selects de status, na ordem do ciclo de vida. */
export const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

export function isStatus(value: string | null): value is AgendamentoStatus {
  return statusOptions.some((o) => o.value === value)
}

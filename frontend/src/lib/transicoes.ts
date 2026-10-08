import type { AgendamentoStatus } from '../api/types'
import { formatDateTime } from './format'

// Transições de status da consulta, como na tabela do enunciado.
// É o espelho de backend/src/consultas/transicoes.ts: aqui serve só para o menu evitar o erro;
// quem decide é o servidor.

export const TRANSICOES: Record<AgendamentoStatus, AgendamentoStatus[]> = {
  agendada: ['confirmada', 'realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'],
  confirmada: ['realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'],
  realizada: [],
  falta: [],
  cancelada_paciente: [],
  cancelada_clinica: [],
}

/** Status final não muda mais (realizada, falta e cancelamentos). */
export function ehFinal(status: AgendamentoStatus): boolean {
  return TRANSICOES[status].length === 0
}

/** Texto da ação no menu, ex.: "Registrar falta". */
export const ACAO_LABELS: Record<AgendamentoStatus, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmar presença',
  realizada: 'Registrar como realizada',
  falta: 'Registrar falta',
  cancelada_paciente: 'Cancelada pelo paciente',
  cancelada_clinica: 'Cancelada pela clínica',
}

export type OpcaoDeStatus = {
  status: AgendamentoStatus
  /** Por que a opção está desabilitada agora; null quando ela vale. */
  motivo: string | null
  /** Comparecimento (realizada, falta) fica separado de confirmação e cancelamento por um divisor. */
  grupo: 'antes' | 'comparecimento' | 'cancelamento'
}

/**
 * Opções do menu para a consulta: todas as transições do status atual, cada uma com o motivo
 * quando não vale agora. Realizada e falta só a partir do horário; confirmação e cancelamento só antes dele.
 */
export function opcoesDeStatus(atual: AgendamentoStatus, inicio: Date, agora: Date): OpcaoDeStatus[] {
  const comecou = agora.getTime() >= inicio.getTime()

  return TRANSICOES[atual].map((status): OpcaoDeStatus => {
    if (status === 'realizada' || status === 'falta') {
      return {
        status,
        motivo: comecou ? null : `Disponível a partir de ${formatDateTime(inicio)}`,
        grupo: 'comparecimento',
      }
    }
    if (status === 'confirmada') {
      return { status, motivo: comecou ? 'Consulta já passou' : null, grupo: 'antes' }
    }
    return { status, motivo: comecou ? 'Só antes do horário da consulta' : null, grupo: 'cancelamento' }
  })
}

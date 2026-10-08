import type { MotivoDescarte, OrigemImportacao, SituacaoImportacao, TipoCorrecao } from '../api/importacoes'

// Textos da tela de importações. Como são Record completos, o build falha se faltar algum rótulo.

export const MOTIVO_LABELS: Record<MotivoDescarte, string> = {
  duplicada: 'Linha duplicada',
  conflito_status: 'Mesmo id com status diferente',
  conflito_horario: 'Mesmo id com horário diferente',
  conflito_horario_slot_ocupado: 'Mesmo id em horário já ocupado',
  conflito_dados: 'Mesmo id com dados diferentes',
  campo_obrigatorio: 'Campo obrigatório vazio',
  data_invalida: 'Data da consulta inválida',
  medico_desconhecido: 'Médico não cadastrado',
  tipo_desconhecido: 'Tipo de atendimento desconhecido',
  status_desconhecido: 'Status desconhecido',
  status_vazio_passado: 'Consulta passada sem status',
  fora_do_slot: 'Fora dos horários de 30 minutos',
  fora_da_grade: 'Fora da grade',
  resultado_no_futuro: 'Resultado em consulta futura',
  passada_sem_resultado: 'Consulta passada sem resultado',
}

export const CORRECAO_LABELS: Record<TipoCorrecao, string> = {
  status_padronizado: 'Status padronizado',
  cancelado_sem_autor: 'Cancelamento sem autor',
  status_vazio_futuro: 'Consulta futura sem status',
  tipo_padronizado: 'Tipo de atendimento padronizado',
  data_formato: 'Data em outro formato',
  data_agendamento_invalida: 'Data da marcação inválida',
  telefone_invalido: 'Telefone inválido',
  nome_padronizado: 'Nome padronizado',
}

export const ORIGEM_LABELS: Record<OrigemImportacao, string> = {
  automatica: 'Automática',
  manual: 'Manual',
}

export const SITUACAO_LABELS: Record<SituacaoImportacao, string> = {
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  falhou: 'Falhou',
}

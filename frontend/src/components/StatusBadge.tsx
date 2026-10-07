import { Badge } from '@mantine/core'
import type { AgendamentoStatus } from '../api/types'
import { STATUS_LABELS } from '../lib/status'
import classes from './StatusBadge.module.css'

const CORES: Record<AgendamentoStatus, { bg: string; color: string }> = {
  agendada: { bg: 'var(--surface-sunken)', color: 'var(--ink-muted)' },
  confirmada: { bg: 'var(--info-soft)', color: 'var(--info)' },
  realizada: { bg: 'var(--brand-soft)', color: 'var(--brand)' },
  falta: { bg: 'var(--danger-soft)', color: 'var(--danger)' },
  cancelada_paciente: { bg: 'var(--warning-soft)', color: 'var(--warning)' },
  cancelada_clinica: { bg: 'transparent', color: 'var(--ink-muted)' },
}

/** Selo com o status do agendamento: sempre ponto e palavra, a cor nunca é o único sinal. */
export function StatusBadge({ status }: { status: AgendamentoStatus }) {
  const { bg, color } = CORES[status]

  return (
    <Badge
      radius="sm"
      className={classes.badge}
      data-status={status}
      // Sobrescreve as variáveis de cor que o Mantine calcula para o Badge.
      vars={() => ({
        root: {
          '--badge-height': '1.5rem',
          '--badge-padding-x': '0.5rem',
          '--badge-fz': '0.75rem',
          '--badge-bg': bg,
          '--badge-color': color,
          '--badge-bd': status === 'cancelada_clinica' ? '1px solid var(--line-strong)' : 'none',
        },
      })}
      leftSection={<span className={classes.dot} aria-hidden="true" />}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

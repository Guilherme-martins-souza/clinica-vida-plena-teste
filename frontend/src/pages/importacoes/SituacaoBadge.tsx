import { Badge } from '@mantine/core'
import type { SituacaoImportacao } from '../../api/importacoes'
import { SITUACAO_LABELS } from '../../lib/importacao'
import classes from './SituacaoBadge.module.css'

const CORES: Record<SituacaoImportacao, { bg: string; color: string }> = {
  concluida: { bg: 'var(--brand-soft)', color: 'var(--brand)' },
  falhou: { bg: 'var(--danger-soft)', color: 'var(--danger)' },
  em_andamento: { bg: 'var(--info-soft)', color: 'var(--info)' },
}

/** Selo com a situação da importação: ponto e palavra, a cor nunca é o único sinal (como o StatusBadge). */
export function SituacaoBadge({ situacao }: { situacao: SituacaoImportacao }) {
  const { bg, color } = CORES[situacao]

  return (
    <Badge
      radius="sm"
      className={classes.badge}
      // Sobrescreve as variáveis de cor que o Mantine calcula para o Badge.
      vars={() => ({
        root: {
          '--badge-height': '1.5rem',
          '--badge-padding-x': '0.5rem',
          '--badge-fz': '0.75rem',
          '--badge-bg': bg,
          '--badge-color': color,
          '--badge-bd': 'none',
        },
      })}
      leftSection={<span className={classes.dot} aria-hidden="true" />}
    >
      {SITUACAO_LABELS[situacao]}
    </Badge>
  )
}

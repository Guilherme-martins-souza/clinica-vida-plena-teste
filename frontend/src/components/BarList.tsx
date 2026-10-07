import type { CSSProperties } from 'react'
import { formatPercent } from '../lib/format'
import classes from './BarList.module.css'

export type BarListRow = {
  label: string
  sublabel?: string
  /** Taxa em % (0 a 100). */
  value: number
  /** Contagem que explica a taxa, ex.: "74 de 214". */
  count?: string
  /** Texto completo da linha para o title (dica ao passar o mouse). */
  description?: string
}

type BarListProps = {
  rows: BarListRow[]
  /** Valor máximo da escala. Use o mesmo em todos os cartões da tela. */
  max: number
  /** Linha de referência, como a média da clínica. */
  reference?: { value: number; label: string }
  /** Variante compacta: esconde a contagem (ela continua no title). */
  compact?: boolean
}

/** Barras horizontais para comparar uma taxa entre categorias. Série única, cor brand. */
export function BarList({ rows, max, reference, compact = false }: BarListProps) {
  const toPercentOfScale = (v: number) => `${Math.min(100, (v / max) * 100)}%`

  return (
    <div>
      <div className={classes.bars} role="list" data-compact={compact || undefined}>
        {rows.map((row) => (
          <div key={row.label} className={classes.row} role="listitem" title={row.description}>
            <span className={classes.name}>
              {row.label}
              {row.sublabel && <small>{row.sublabel}</small>}
            </span>
            <span
              className={classes.track}
              data-ref={reference ? true : undefined}
              // Variável CSS própria: o TypeScript não conhece, por isso o "as CSSProperties".
              style={reference ? ({ '--ref': toPercentOfScale(reference.value) } as CSSProperties) : undefined}
            >
              <span className={classes.fill} style={{ width: toPercentOfScale(row.value) }} />
            </span>
            <span className={classes.value}>{formatPercent(row.value)}</span>
            {!compact && <span className={classes.count}>{row.count}</span>}
          </div>
        ))}
      </div>

      {reference && (
        <div className={classes.legend}>
          <span>
            <span className={classes.legendRef} />
            {reference.label}: {formatPercent(reference.value)}
          </span>
          <span>Escala de 0 a {max}%</span>
        </div>
      )}
    </div>
  )
}

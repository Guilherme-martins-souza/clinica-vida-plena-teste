import type { CSSProperties } from 'react'
import classes from './HeatGrid.module.css'

type HeatGridProps = {
  /** Rótulo da tabela para leitores de tela. */
  label: string
  columns: string[]
  rows: { label: string; values: number[] }[]
  /** Formata o valor escrito na célula. */
  format: (value: number) => string
  /** Texto do title de cada célula, ex.: "Seg, manhã: 41% de falta". */
  describe?: (row: string, column: string, value: number) => string
}

// A cor da célula vai de 6% a 46% de brand sobre surface, o que mantém o texto legível nos dois temas.
const MIN_MIX = 6
const MAX_MIX = 46

/** Grade de calor para cruzar duas dimensões pequenas (dia da semana × turno). */
export function HeatGrid({ label, columns, rows, format, describe }: HeatGridProps) {
  const all = rows.flatMap((r) => r.values)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const intensity = (v: number) => (max === min ? MIN_MIX : MIN_MIX + ((v - min) / (max - min)) * (MAX_MIX - MIN_MIX))

  return (
    <div
      className={classes.grid}
      role="table"
      aria-label={label}
      style={{ gridTemplateColumns: `auto repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      <div role="row" className={classes.rowGroup}>
        <span role="columnheader" />
        {columns.map((c) => (
          <span key={c} role="columnheader" className={classes.head}>
            {c}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.label} role="row" className={classes.rowGroup}>
          <span role="rowheader" className={classes.side}>
            {row.label}
          </span>
          {row.values.map((v, i) => (
            <span
              key={columns[i]}
              role="cell"
              className={classes.cell}
              // Variável CSS própria: o TypeScript não conhece, por isso o "as CSSProperties".
              style={{ '--v': intensity(v).toFixed(0) } as CSSProperties}
              title={describe?.(row.label, columns[i], v)}
            >
              {format(v)}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Legenda "Menor → Maior" com a leitura principal da grade. */
export function HeatGridLegend({ insight }: { insight: string }) {
  return (
    <div className={classes.legend}>
      <span>
        Menor
        <span className={classes.scale} />
        Maior
      </span>
      <span>{insight}</span>
    </div>
  )
}

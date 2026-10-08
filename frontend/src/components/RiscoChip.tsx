import type { NivelRisco } from '../api/prevencao'
import { RISCO_LABELS } from '../lib/risco'
import classes from './RiscoChip.module.css'

/** Chip da chance de faltar: palavra e ponto (a cor nunca é o único sinal). Média usa aviso; alta e muito alta usam o tom de falta. */
export function RiscoChip({ nivel }: { nivel: NivelRisco }) {
  return (
    <span className={classes.chip} data-nivel={nivel}>
      <span className={classes.ponto} aria-hidden="true" />
      {RISCO_LABELS[nivel]}
    </span>
  )
}

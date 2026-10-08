import classes from './FaltosoChip.module.css'

/** Chip ao lado do nome do paciente que costuma faltar (25% ou mais de faltas nos 5 últimos atendimentos). */
export function FaltosoChip() {
  return (
    <span className={classes.chip} title="25% ou mais de faltas nos 5 últimos atendimentos">
      faltoso
    </span>
  )
}

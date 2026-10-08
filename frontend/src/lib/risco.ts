import type { NivelRisco } from '../api/prevencao'

/** Palavra de cada nível de chance de faltar, no chip e no filtro. */
export const RISCO_LABELS: Record<NivelRisco, string> = {
  media: 'Média',
  alta: 'Alta',
  muito_alta: 'Muito alta',
}

import type { Periodo } from '../api/types'

// Atalhos do filtro de período e o cálculo do intervalo de cada um.

export type PeriodoAtalho = '30d' | '3m' | '12m' | 'personalizado'

export const ATALHOS: { value: PeriodoAtalho; label: string }[] = [
  { value: '30d', label: '30 dias' },
  { value: '3m', label: '3 meses' },
  { value: '12m', label: '12 meses' },
  { value: 'personalizado', label: 'Personalizado' },
]

export function isPeriodoAtalho(value: string | null): value is PeriodoAtalho {
  return ATALHOS.some((a) => a.value === value)
}

/** Intervalo de um atalho, terminando hoje. Ex.: 12 meses em 07/10/2026 → 08/10/2025 a 07/10/2026. */
export function resolvePeriodo(atalho: PeriodoAtalho, hoje = new Date()): Periodo {
  const de = new Date(hoje)
  if (atalho === '30d') de.setDate(de.getDate() - 29)
  else if (atalho === '3m') de.setMonth(de.getMonth() - 3, de.getDate() + 1)
  else de.setFullYear(de.getFullYear() - 1, de.getMonth(), de.getDate() + 1) // 12m e, por enquanto, personalizado
  return { de, ate: hoje }
}

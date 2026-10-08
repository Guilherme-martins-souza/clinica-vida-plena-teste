import type { Periodo } from '../api/types'

// Atalhos do filtro de período, o cálculo do intervalo de cada um e a leitura do período da URL.

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
export function resolvePeriodo(atalho: Exclude<PeriodoAtalho, 'personalizado'>, hoje = new Date()): Periodo {
  const de = new Date(hoje)
  if (atalho === '30d') de.setDate(de.getDate() - 29)
  else if (atalho === '3m') de.setMonth(de.getMonth() - 3, de.getDate() + 1)
  else de.setFullYear(de.getFullYear() - 1, de.getMonth(), de.getDate() + 1)
  return { de, ate: hoje }
}

// O dia é sempre lido no fuso da clínica, como o resto das datas da tela.
const diaIsoFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Dia da data no formato da API (AAAA-MM-DD), no fuso de São Paulo. Ex.: 07/10/2026 → "2026-10-07". */
export function toDataIso(date: Date): string {
  // O locale en-CA escreve a data já como AAAA-MM-DD.
  return diaIsoFormat.format(date)
}

/** "2026-01-31" → Date ao meio-dia desse dia em São Paulo; null se o texto não for uma data válida. */
export function fromDataIso(texto: string | null): Date | null {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
  const data = new Date(`${texto}T12:00:00-03:00`)
  // Datas que não existem (ex.: 2026-02-30) "pulam" para outro dia: aí não batem com o texto.
  return toDataIso(data) === texto ? data : null
}

/**
 * Período da tela a partir da URL: `?periodo=30d|3m|12m` ou `?periodo=personalizado&de=AAAA-MM-DD&ate=AAAA-MM-DD`.
 * Sem atalho, com atalho desconhecido ou com datas inválidas, vale o atalho de 12 meses.
 */
export function lerPeriodoDaUrl(
  params: URLSearchParams,
  hoje = new Date(),
): { atalho: PeriodoAtalho; periodo: Periodo } {
  const param = params.get('periodo')

  if (param === 'personalizado') {
    const de = fromDataIso(params.get('de'))
    const ate = fromDataIso(params.get('ate'))
    if (de && ate && de <= ate) return { atalho: 'personalizado', periodo: { de, ate } }
  } else if (isPeriodoAtalho(param) && param !== 'personalizado') {
    return { atalho: param, periodo: resolvePeriodo(param, hoje) }
  }

  return { atalho: '12m', periodo: resolvePeriodo('12m', hoje) }
}

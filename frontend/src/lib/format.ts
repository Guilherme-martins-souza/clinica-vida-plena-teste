// Formatação de números e datas no padrão do design system (pt-BR, fuso America/Sao_Paulo).

const TIME_ZONE = 'America/Sao_Paulo'

const integerFormat = new Intl.NumberFormat('pt-BR')
const percentFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 1180 → "1.180" */
export function formatInteger(value: number): string {
  return integerFormat.format(value)
}

/** 28.05 → "28,1%" */
export function formatPercent(value: number): string {
  return `${percentFormat.format(value)}%`
}

/** -1.6 → "−1,6 p.p." (com o sinal de menos tipográfico) */
export function formatPointsDelta(value: number): string {
  const sign = value < 0 ? '−' : '+'
  return `${sign}${percentFormat.format(Math.abs(value))} p.p.`
}

/** Taxa em % a partir de parte e total; 0 quando o total é 0. */
export function rate(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * 100
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function partsInTimeZone(date: Date): { day: string; month: number; year: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? ''
  return { day: get('day'), month: Number(get('month')), year: get('year'), hour: get('hour'), minute: get('minute') }
}

/** "12 out 2026" */
export function formatDate(date: Date): string {
  const p = partsInTimeZone(date)
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`
}

/** A data cai no dia de hoje, no fuso da clínica? */
export function isToday(date: Date, hoje = new Date()): boolean {
  return formatDate(date) === formatDate(hoje)
}

/** "08:30" */
export function formatTime(date: Date): string {
  const p = partsInTimeZone(date)
  return `${p.hour}:${p.minute}`
}

/** "08 out 2025 – 07 out 2026" */
export function formatDateRange(from: Date, to: Date): string {
  return `${formatDate(from)} – ${formatDate(to)}`
}

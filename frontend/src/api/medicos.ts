import { getJson, isJsonObject } from './http'
import type { Medico, Pagina } from './types'

// Busca da API de médicos (GET /api/medicos). Os nomes dos campos são os mesmos do backend.

export type DiaSemana = 'domingo' | 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado'

export const DIAS_SEMANA: DiaSemana[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

/** Um bloco de atendimento do médico, ex.: segunda das 07:00 às 12:00. */
export type GradeItem = { dia: DiaSemana; inicio: string; fim: string }

export type MedicoComGrade = Medico & { grade: GradeItem[] }

/** Lança um erro claro quando a API devolve algo fora do formato esperado. */
function formatoInvalido(): never {
  throw new Error('A API devolveu os médicos num formato inesperado.')
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : formatoInvalido()
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : formatoInvalido()
}

function toDia(value: unknown): DiaSemana {
  const dia = DIAS_SEMANA.find((d) => d === value)
  return dia ?? formatoInvalido()
}

function toGradeItem(item: unknown): GradeItem {
  if (!isJsonObject(item)) return formatoInvalido()
  return { dia: toDia(item.dia), inicio: toText(item.inicio), fim: toText(item.fim) }
}

function toMedico(item: unknown): MedicoComGrade {
  if (!isJsonObject(item) || !Array.isArray(item.grade)) return formatoInvalido()
  return {
    id: toText(item.id),
    nome: toText(item.nome),
    especialidade: toText(item.especialidade),
    grade: item.grade.map(toGradeItem),
  }
}

/** Uma página dos médicos, em ordem de nome (a API já devolve nessa ordem). */
export async function fetchMedicos(pagina: number, porPagina: number): Promise<Pagina<MedicoComGrade>> {
  const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) })
  const corpo = await getJson(`/api/medicos?${params}`)
  if (!isJsonObject(corpo) || !Array.isArray(corpo.itens)) return formatoInvalido()
  return {
    itens: corpo.itens.map(toMedico),
    total: toNumber(corpo.total),
    pagina: toNumber(corpo.pagina),
    porPagina: toNumber(corpo.porPagina),
  }
}

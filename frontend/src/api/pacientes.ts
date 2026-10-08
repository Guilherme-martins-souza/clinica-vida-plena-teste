import { getJson, isJsonObject } from './http'
import type { ContagemFaltas, Pagina } from './types'

// Busca da API de pacientes (GET /api/pacientes). Os nomes dos campos são os mesmos do backend.

/** Paciente com o histórico de faltas (mesma regra dos indicadores, sobre todas as consultas dele). */
export type PacienteResumo = ContagemFaltas & {
  id: string
  nome: string
  /** Só dígitos (DDD + número); null quando o arquivo não trouxe um telefone válido. */
  telefone: string | null
}

export type FiltroPacientes = {
  /** Trecho do nome; a API ignora maiúsculas e acentos. */
  busca: string
  pagina: number
  porPagina: number
}

/** Lança um erro claro quando a API devolve algo fora do formato esperado. */
function formatoInvalido(): never {
  throw new Error('A API devolveu os pacientes num formato inesperado.')
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : formatoInvalido()
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : formatoInvalido()
}

function toPaciente(item: unknown): PacienteResumo {
  if (!isJsonObject(item)) return formatoInvalido()
  return {
    id: toText(item.id),
    nome: toText(item.nome),
    telefone: item.telefone === null ? null : toText(item.telefone),
    concluidas: toNumber(item.concluidas),
    faltas: toNumber(item.faltas),
  }
}

/** Uma página dos pacientes, em ordem de nome, filtrada pela busca. */
export async function fetchPacientes(filtro: FiltroPacientes): Promise<Pagina<PacienteResumo>> {
  const params = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: String(filtro.porPagina) })
  const busca = filtro.busca.trim()
  if (busca) params.set('busca', busca)

  const corpo = await getJson(`/api/pacientes?${params}`)
  if (!isJsonObject(corpo) || !Array.isArray(corpo.itens)) return formatoInvalido()
  return {
    itens: corpo.itens.map(toPaciente),
    total: toNumber(corpo.total),
    pagina: toNumber(corpo.pagina),
    porPagina: toNumber(corpo.porPagina),
  }
}

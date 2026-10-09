import { getJson, isJsonObject, postJson, type JsonObject } from './http'
import type { Pagina } from './types'

// Chamadas da API da lista de espera (/api/lista-espera): a tela Lista de espera e o modal "Remarcar".

/** Uma pessoa da lista de espera. */
export type PessoaEspera = {
  id: string
  nome: string
  /** Só dígitos: DDD + número. */
  telefone: string
  /** Médico pedido; null = aceita qualquer um. */
  medicoId: string | null
  /** Apenas informativo: quer antecipar uma consulta que já tem. */
  antecipar: boolean
  criadoEm: Date
}

function formatoInvalido(): never {
  throw new Error('A API devolveu a lista de espera num formato inesperado.')
}

function toObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : formatoInvalido()
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : formatoInvalido()
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : formatoInvalido()
}

function toPessoa(item: unknown): PessoaEspera {
  const pessoa = toObject(item)
  if (typeof pessoa.antecipar !== 'boolean') return formatoInvalido()
  return {
    id: toText(pessoa.id),
    nome: toText(pessoa.nome),
    telefone: toText(pessoa.telefone),
    medicoId: pessoa.medicoId === null ? null : toText(pessoa.medicoId),
    antecipar: pessoa.antecipar,
    criadoEm: new Date(toText(pessoa.criadoEm)),
  }
}

export type FiltroEspera = {
  /** Só quem pediu exatamente esse médico; null traz a lista inteira. */
  medicoId: string | null
  pagina: number
  porPagina: number
}

/** Uma página da lista de espera, da pessoa mais antiga para a mais nova. */
export async function listarEspera(filtro: FiltroEspera): Promise<Pagina<PessoaEspera>> {
  const params = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: String(filtro.porPagina) })
  if (filtro.medicoId) params.set('medicoId', filtro.medicoId)
  const corpo = toObject(await getJson(`/api/lista-espera?${params}`))
  if (!Array.isArray(corpo.itens)) return formatoInvalido()
  return {
    itens: corpo.itens.map(toPessoa),
    total: toNumber(corpo.total),
    pagina: toNumber(corpo.pagina),
    porPagina: toNumber(corpo.porPagina),
  }
}

export type NovaPessoaEspera = {
  nome: string
  /** Só dígitos, com DDD (10 ou 11). */
  telefone: string
  medicoId: string | null
  antecipar: boolean
}

/** Cadastra na lista de espera. Dados inválidos voltam como ApiError DADOS_INVALIDOS. */
export async function criarPessoaEspera(dados: NovaPessoaEspera): Promise<PessoaEspera> {
  return toPessoa(await postJson('/api/lista-espera', dados))
}

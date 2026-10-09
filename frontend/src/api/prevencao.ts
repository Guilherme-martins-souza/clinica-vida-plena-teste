import { toLinha, type ConsultaLinha } from './consultas'
import { getJson, isJsonObject, postJson, type JsonObject } from './http'
import type { Pagina } from './types'

// Chamadas da API da aba Prevenção de Faltas (/api/prevencao-de-faltas) e do envio de mensagens.

/** Níveis que aparecem na aba; o risco baixo não é listado. */
export type NivelRisco = 'media' | 'alta' | 'muito_alta'

export type CodigoFator = 'historico' | 'primeiraConsulta' | 'convenio' | 'segundaDeManha' | 'semConfirmacao'

export type FatorRisco = { codigo: CodigoFator; pontos: number }

/** Uma consulta da aba: a linha da lista de agendamentos mais o risco calculado. */
export type ConsultaPrevencao = ConsultaLinha & {
  risco: { pontos: number; nivel: NivelRisco; fatores: FatorRisco[] }
}

/** Conta do risco (GET /api/prevencao-de-faltas/regras), usada no banner de legenda. */
export type Regras = {
  cortes: { media: number; alta: number; muitoAlta: number }
  fatores: { codigo: CodigoFator; rotulo: string; pontos: number }[]
}

/** Mensagem 2 (confirmacao) ou 3 (lembrete). */
export type TipoMensagem = 'confirmacao' | 'lembrete'

function formatoInvalido(): never {
  throw new Error('A API devolveu a prevenção de faltas num formato inesperado.')
}

function toObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : formatoInvalido()
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : formatoInvalido()
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : formatoInvalido()
}

function toNivel(value: unknown): NivelRisco {
  return value === 'media' || value === 'alta' || value === 'muito_alta' ? value : formatoInvalido()
}

const CODIGOS: CodigoFator[] = ['historico', 'primeiraConsulta', 'convenio', 'segundaDeManha', 'semConfirmacao']

function toCodigo(value: unknown): CodigoFator {
  return CODIGOS.find((codigo) => codigo === value) ?? formatoInvalido()
}

function toPrevencao(item: unknown): ConsultaPrevencao {
  const risco = toObject(toObject(item).risco)
  if (!Array.isArray(risco.fatores)) return formatoInvalido()
  return {
    ...toLinha(item),
    risco: {
      pontos: toNumber(risco.pontos),
      nivel: toNivel(risco.nivel),
      fatores: risco.fatores.map((f) => {
        const fator = toObject(f)
        return { codigo: toCodigo(fator.codigo), pontos: toNumber(fator.pontos) }
      }),
    },
  }
}

/** Uma página das consultas de risco dos próximos 14 dias; `nivel` null mostra todas. */
export async function listarPrevencao(nivel: NivelRisco | null, pagina: number): Promise<Pagina<ConsultaPrevencao>> {
  const params = new URLSearchParams({ pagina: String(pagina) })
  if (nivel) params.set('nivel', nivel)

  const corpo = toObject(await getJson(`/api/prevencao-de-faltas?${params}`))
  if (!Array.isArray(corpo.itens)) return formatoInvalido()
  return {
    itens: corpo.itens.map(toPrevencao),
    total: toNumber(corpo.total),
    pagina: toNumber(corpo.pagina),
    porPagina: toNumber(corpo.porPagina),
  }
}

/** Pesos e cortes do risco, para o banner explicar a conta com os números que a API usa. */
export async function buscarRegras(): Promise<Regras> {
  const corpo = toObject(await getJson('/api/prevencao-de-faltas/regras'))
  const cortes = toObject(corpo.cortes)
  if (!Array.isArray(corpo.fatores)) return formatoInvalido()
  return {
    cortes: { media: toNumber(cortes.media), alta: toNumber(cortes.alta), muitoAlta: toNumber(cortes.muitoAlta) },
    fatores: corpo.fatores.map((f) => {
      const fator = toObject(f)
      return { codigo: toCodigo(fator.codigo), rotulo: toText(fator.rotulo), pontos: toNumber(fator.pontos) }
    }),
  }
}

/** Envia a mensagem de WhatsApp da consulta. Se a API recusar (SEM_TELEFONE, MENSAGEM_NAO_ENVIADA...), lança ApiError. */
export async function enviarMensagem(consultaId: string, tipo: TipoMensagem): Promise<void> {
  await postJson(`/api/consultas/${encodeURIComponent(consultaId)}/mensagens`, { tipo })
}

/**
 * Oferece o horário da consulta à pessoa da lista de espera indicada em `listaEsperaId` ou, sem ela, à primeira pessoa
 * elegível. Sem ninguém, a API responde 404 SEM_LISTA_DE_ESPERA (ApiError).
 */
export async function oferecerVaga(consultaId: string, listaEsperaId?: string): Promise<void> {
  await postJson(`/api/consultas/${encodeURIComponent(consultaId)}/oferecer-vaga`, { listaEsperaId })
}

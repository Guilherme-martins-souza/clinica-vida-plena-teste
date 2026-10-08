import { getJson, isJsonObject, patchJson, postJson, type JsonObject } from './http'
import type { AgendamentoStatus, Medico, Pagina, TipoAtendimento } from './types'
import { isStatus } from '../lib/status'

// Chamadas da API de consultas (/api/consultas) e da grade de horários do médico.
// Os nomes dos campos são os mesmos do backend; cada função confere o formato antes de entregar para a tela.

/** Abas da tela de agendamentos. */
export type Aba = 'hoje' | 'proximas' | 'aguardando' | 'todas'

/** Uma linha da lista de consultas (GET /api/consultas). */
export type ConsultaLinha = {
  id: string
  /** Código do arquivo (ex.: AG00001) ou, nas consultas criadas pela tela, o fim do id. */
  codigo: string
  paciente: { id: string; nome: string; telefone: string | null }
  primeiraConsulta: boolean
  /** Paciente com 25% ou mais de faltas nos 5 últimos atendimentos. */
  faltoso: boolean
  medico: Medico
  tipoAtendimento: TipoAtendimento
  marcadaEm: Date | null
  inicio: Date
  status: AgendamentoStatus
  /** Conta como falta: status `falta` ou cancelamento do paciente a menos de 24 h. */
  consideradoFalta: boolean
}

/** Consulta como o POST e o PATCH devolvem (sem nomes de paciente e médico). */
export type Consulta = {
  id: string
  codigoLegado: string | null
  pacienteId: string
  medicoId: string
  tipoAtendimento: TipoAtendimento
  inicio: Date
  marcadaEm: Date | null
  canceladaEm: Date | null
  status: AgendamentoStatus
  consideradoFalta: boolean
}

export type FiltroConsultas = {
  aba: Aba
  /** Trecho do nome do paciente; a API ignora maiúsculas e acentos. */
  busca: string
  status: AgendamentoStatus | null
  medicoId: string | null
  /** Dias AAAA-MM-DD; só valem na aba "todas". */
  de: string | null
  ate: string | null
  pagina: number
  porPagina: number
}

export type ContagensAbas = Record<Aba, number>

export type NovaConsulta = {
  pacienteId: string
  medicoId: string
  tipoAtendimento: TipoAtendimento
  /** Data e hora em ISO 8601 com fuso (ex.: 2026-10-12T09:00:00.000Z). */
  inicio: string
}

export type SituacaoSlot = 'livre' | 'ocupado' | 'passado'

export type Slot = { inicio: Date; situacao: SituacaoSlot }

/** Resposta de GET /api/medicos/:id/horarios. */
export type HorariosDoDia = {
  data: string
  slots: Slot[]
  /** Próximo dia (AAAA-MM-DD) com horário livre quando este não tem; senão null. */
  proximoDiaComVaga: string | null
}

/** Lança um erro claro quando a API devolve algo fora do formato esperado. */
function formatoInvalido(): never {
  throw new Error('A API devolveu as consultas num formato inesperado.')
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

function toTextOuNull(value: unknown): string | null {
  return value === null ? null : toText(value)
}

function toDate(value: unknown): Date {
  const data = new Date(toText(value))
  return Number.isNaN(data.getTime()) ? formatoInvalido() : data
}

function toDateOuNull(value: unknown): Date | null {
  return value === null ? null : toDate(value)
}

function toStatus(value: unknown): AgendamentoStatus {
  return typeof value === 'string' && isStatus(value) ? value : formatoInvalido()
}

function toTipo(value: unknown): TipoAtendimento {
  return value === 'convenio' || value === 'particular' ? value : formatoInvalido()
}

function toSituacao(value: unknown): SituacaoSlot {
  return value === 'livre' || value === 'ocupado' || value === 'passado' ? value : formatoInvalido()
}

export function toLinha(item: unknown): ConsultaLinha {
  const c = toObject(item)
  const paciente = toObject(c.paciente)
  const medico = toObject(c.medico)
  return {
    id: toText(c.id),
    codigo: toText(c.codigo),
    paciente: { id: toText(paciente.id), nome: toText(paciente.nome), telefone: toTextOuNull(paciente.telefone) },
    primeiraConsulta: c.primeiraConsulta === true,
    faltoso: c.faltoso === true,
    medico: { id: toText(medico.id), nome: toText(medico.nome), especialidade: toText(medico.especialidade) },
    tipoAtendimento: toTipo(c.tipoAtendimento),
    marcadaEm: toDateOuNull(c.marcadaEm),
    inicio: toDate(c.inicio),
    status: toStatus(c.status),
    consideradoFalta: c.consideradoFalta === true,
  }
}

function toConsulta(corpo: unknown): Consulta {
  const c = toObject(corpo)
  return {
    id: toText(c.id),
    codigoLegado: toTextOuNull(c.codigoLegado),
    pacienteId: toText(c.pacienteId),
    medicoId: toText(c.medicoId),
    tipoAtendimento: toTipo(c.tipoAtendimento),
    inicio: toDate(c.inicio),
    marcadaEm: toDateOuNull(c.marcadaEm),
    canceladaEm: toDateOuNull(c.canceladaEm),
    status: toStatus(c.status),
    consideradoFalta: c.consideradoFalta === true,
  }
}

/** Filtros em comum da lista e das contagens, como query string. Campos vazios ficam de fora. */
function paramsDoFiltro(filtro: Omit<FiltroConsultas, 'aba' | 'pagina' | 'porPagina'>): URLSearchParams {
  const params = new URLSearchParams()
  const busca = filtro.busca.trim()
  if (busca) params.set('busca', busca)
  if (filtro.status) params.set('status', filtro.status)
  if (filtro.medicoId) params.set('medicoId', filtro.medicoId)
  if (filtro.de) params.set('de', filtro.de)
  if (filtro.ate) params.set('ate', filtro.ate)
  return params
}

/** Uma página das consultas da aba, com os filtros. */
export async function fetchConsultas(filtro: FiltroConsultas): Promise<Pagina<ConsultaLinha>> {
  const params = paramsDoFiltro(filtro)
  params.set('aba', filtro.aba)
  params.set('pagina', String(filtro.pagina))
  params.set('porPagina', String(filtro.porPagina))

  const corpo = toObject(await getJson(`/api/consultas?${params}`))
  if (!Array.isArray(corpo.itens)) return formatoInvalido()
  return {
    itens: corpo.itens.map(toLinha),
    total: toNumber(corpo.total),
    pagina: toNumber(corpo.pagina),
    porPagina: toNumber(corpo.porPagina),
  }
}

/** Total de cada aba com os mesmos filtros (o período só vale na aba "todas"). */
export async function fetchContagens(
  filtro: Omit<FiltroConsultas, 'aba' | 'pagina' | 'porPagina'>,
): Promise<ContagensAbas> {
  const corpo = toObject(await getJson(`/api/consultas/contagens?${paramsDoFiltro(filtro)}`))
  return {
    hoje: toNumber(corpo.hoje),
    proximas: toNumber(corpo.proximas),
    aguardando: toNumber(corpo.aguardando),
    todas: toNumber(corpo.todas),
  }
}

/** Marca uma consulta. Se a API recusar, lança ApiError com o code (ex.: HORARIO_OCUPADO) e a mensagem. */
export async function criarConsulta(dados: NovaConsulta): Promise<Consulta> {
  return toConsulta(await postJson('/api/consultas', dados))
}

/** Troca o status da consulta. Se a API recusar, lança ApiError com o code e a mensagem. */
export async function alterarStatus(id: string, status: AgendamentoStatus): Promise<Consulta> {
  return toConsulta(await patchJson(`/api/consultas/${encodeURIComponent(id)}/status`, { status }))
}

/** Slots de 30 min da grade do médico no dia (AAAA-MM-DD), cada um livre, ocupado ou passado. */
export async function fetchHorarios(medicoId: string, data: string): Promise<HorariosDoDia> {
  const params = new URLSearchParams({ data })
  const corpo = toObject(await getJson(`/api/medicos/${encodeURIComponent(medicoId)}/horarios?${params}`))
  if (!Array.isArray(corpo.slots)) return formatoInvalido()
  return {
    data: toText(corpo.data),
    slots: corpo.slots.map((item) => {
      const slot = toObject(item)
      return { inicio: toDate(slot.inicio), situacao: toSituacao(slot.situacao) }
    }),
    proximoDiaComVaga: toTextOuNull(corpo.proximoDiaComVaga),
  }
}

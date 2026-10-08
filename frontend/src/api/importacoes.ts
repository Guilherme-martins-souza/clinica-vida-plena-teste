import { getJson, isJsonObject, type JsonObject } from './http'
import type { Pagina } from './types'

// Tipos e buscas da API de importações (GET /api/importacoes).
// Os nomes dos campos são os mesmos do backend (backend/src/models/importacao.ts).

export type OrigemImportacao = 'automatica' | 'manual'
export type SituacaoImportacao = 'em_andamento' | 'concluida' | 'falhou'

export type MotivoDescarte =
  | 'duplicada'
  | 'conflito_status'
  | 'conflito_horario'
  | 'conflito_horario_slot_ocupado'
  | 'conflito_dados'
  | 'campo_obrigatorio'
  | 'data_invalida'
  | 'medico_desconhecido'
  | 'tipo_desconhecido'
  | 'status_desconhecido'
  | 'status_vazio_passado'
  | 'fora_do_slot'
  | 'fora_da_grade'
  | 'resultado_no_futuro'
  | 'passada_sem_resultado'
  | 'horario_ocupado'

export type TipoCorrecao =
  | 'status_padronizado'
  | 'cancelado_sem_autor'
  | 'status_vazio_futuro'
  | 'tipo_padronizado'
  | 'data_formato'
  | 'data_agendamento_invalida'
  | 'telefone_invalido'
  | 'nome_padronizado'

export type TotaisImportacao = {
  lidas: number
  importadas: number
  corrigidas: number
  descartadas: number
  medicos: number
  pacientes: number
}

/** Uma linha da lista de importações. */
export type ImportacaoResumo = {
  id: string
  origem: OrigemImportacao
  situacao: SituacaoImportacao
  iniciadaEm: Date
  finalizadaEm: Date | null
  /** Vazio enquanto a importação está em andamento ou quando ela falhou. */
  totais: TotaisImportacao | null
}

/** Linha do CSV que não entrou, com as 9 colunas como vieram no arquivo. */
export type Descarte = {
  linha: number
  codigo: string
  motivo: MotivoDescarte
  valores: Record<string, string>
}

export type ImportacaoDetalhe = ImportacaoResumo & {
  erro: string | null
  dataReferencia: Date | null
  descartesPorMotivo: Partial<Record<MotivoDescarte, number>>
  correcoesPorTipo: Partial<Record<TipoCorrecao, number>>
}

/** Lança um erro claro quando a API devolve algo fora do formato esperado. */
function formatoInvalido(): never {
  throw new Error('A API devolveu as importações num formato inesperado.')
}

function toDate(value: unknown): Date {
  if (typeof value !== 'string') return formatoInvalido()
  return new Date(value)
}

function toDateOrNull(value: unknown): Date | null {
  return value === null || value === undefined ? null : toDate(value)
}

// Os campos de texto fixo (origem, situação, motivo...) vêm do próprio backend, que valida
// os valores no schema; aqui conferimos só a estrutura e convertemos as datas.
function toResumo(item: unknown): ImportacaoResumo {
  if (!isJsonObject(item) || typeof item.id !== 'string') return formatoInvalido()
  return {
    id: item.id,
    origem: item.origem === 'manual' ? 'manual' : 'automatica',
    situacao: toSituacao(item.situacao),
    iniciadaEm: toDate(item.iniciadaEm),
    finalizadaEm: toDateOrNull(item.finalizadaEm),
    totais: isJsonObject(item.totais) ? toTotais(item.totais) : null,
  }
}

function toSituacao(value: unknown): SituacaoImportacao {
  if (value === 'em_andamento' || value === 'concluida' || value === 'falhou') return value
  return formatoInvalido()
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : formatoInvalido()
}

function toTotais(totais: JsonObject): TotaisImportacao {
  return {
    lidas: toNumber(totais.lidas),
    importadas: toNumber(totais.importadas),
    corrigidas: toNumber(totais.corrigidas),
    descartadas: toNumber(totais.descartadas),
    medicos: toNumber(totais.medicos),
    pacientes: toNumber(totais.pacientes),
  }
}

/** Contagens { chave: número }; ignora o que não é número. */
function toContagens<K extends string>(value: unknown): Partial<Record<K, number>> {
  const contagens: Partial<Record<string, number>> = {}
  if (isJsonObject(value)) {
    for (const [chave, n] of Object.entries(value)) {
      if (typeof n === 'number') contagens[chave] = n
    }
  }
  return contagens
}

function toTextos(value: unknown): Record<string, string> {
  const textos: Record<string, string> = {}
  if (isJsonObject(value)) {
    for (const [chave, texto] of Object.entries(value)) textos[chave] = String(texto ?? '')
  }
  return textos
}

function toDescarte(item: unknown): Descarte {
  if (!isJsonObject(item) || typeof item.codigo !== 'string' || typeof item.motivo !== 'string') {
    return formatoInvalido()
  }
  return {
    linha: toNumber(item.linha),
    codigo: item.codigo,
    // O backend só grava motivos da lista (enum no schema).
    motivo: item.motivo as MotivoDescarte,
    valores: toTextos(item.valores),
  }
}

function toDetalhe(item: unknown): ImportacaoDetalhe {
  const resumo = toResumo(item)
  if (!isJsonObject(item)) return formatoInvalido()
  return {
    ...resumo,
    erro: typeof item.erro === 'string' ? item.erro : null,
    dataReferencia: toDateOrNull(item.dataReferencia),
    descartesPorMotivo: toContagens<MotivoDescarte>(item.descartesPorMotivo),
    correcoesPorTipo: toContagens<TipoCorrecao>(item.correcoesPorTipo),
  }
}

/** Importações da mais recente para a mais antiga (a API já devolve nessa ordem). */
export async function fetchImportacoes(): Promise<ImportacaoResumo[]> {
  const corpo = await getJson('/api/importacoes')
  if (!Array.isArray(corpo)) return formatoInvalido()
  return corpo.map(toResumo)
}

export async function fetchImportacao(id: string): Promise<ImportacaoDetalhe> {
  return toDetalhe(await getJson(`/api/importacoes/${encodeURIComponent(id)}`))
}

export type FiltroDescartes = {
  motivo: MotivoDescarte | null
  pagina: number
  porPagina: number
}

/** Uma página das linhas descartadas, na ordem do arquivo; a paginação e o filtro rodam no backend. */
export async function fetchDescartes(id: string, filtro: FiltroDescartes): Promise<Pagina<Descarte>> {
  const params = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: String(filtro.porPagina) })
  if (filtro.motivo) params.set('motivo', filtro.motivo)

  const corpo = await getJson(`/api/importacoes/${encodeURIComponent(id)}/descartes?${params}`)
  if (!isJsonObject(corpo) || !Array.isArray(corpo.itens)) return formatoInvalido()
  return {
    itens: corpo.itens.map(toDescarte),
    total: toNumber(corpo.total),
    pagina: toNumber(corpo.pagina),
    porPagina: toNumber(corpo.porPagina),
  }
}

/** Endereço do CSV das linhas descartadas, para um link de download. */
export function urlCsvDescartes(id: string): string {
  return `/api/importacoes/${encodeURIComponent(id)}/descartes.csv`
}

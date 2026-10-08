// Chamadas à API do backend. O Vite repassa /api para o backend (ver vite.config.ts).

/** Objeto JSON qualquer: serve para conferir o formato do que a API devolveu. */
export type JsonObject = Record<string, unknown>

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Erro devolvido pela API no formato { error: { code, message } }.
 * O `code` (ex.: HORARIO_OCUPADO) deixa a tela decidir onde mostrar o erro;
 * o `message` já vem em português, pronto para o usuário.
 */
export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Monta o ApiError a partir do corpo da resposta; sem o formato esperado, usa uma mensagem genérica. */
function erroDaResposta(status: number, corpo: unknown): ApiError {
  if (isJsonObject(corpo) && isJsonObject(corpo.error) && typeof corpo.error.message === 'string') {
    const code = typeof corpo.error.code === 'string' ? corpo.error.code : 'ERRO_DESCONHECIDO'
    return new ApiError(status, code, corpo.error.message)
  }
  return new ApiError(status, 'ERRO_DESCONHECIDO', `Erro ${status} ao acessar a API.`)
}

/**
 * Faz a requisição e devolve o corpo JSON como `unknown`: quem chama confere o formato.
 * Se a resposta não for 2xx, lança um ApiError com o código e a mensagem que a API mandou.
 */
async function requisicao(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init)
  // Corpo vazio ou que não é JSON vira null.
  const corpo: unknown = await res.json().catch(() => null)
  if (!res.ok) throw erroDaResposta(res.status, corpo)
  return corpo
}

/** GET em JSON. */
export function getJson(url: string): Promise<unknown> {
  return requisicao(url)
}

/** POST com corpo JSON. */
export function postJson(url: string, dados: unknown): Promise<unknown> {
  return requisicao(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

/** PATCH com corpo JSON. */
export function patchJson(url: string, dados: unknown): Promise<unknown> {
  return requisicao(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

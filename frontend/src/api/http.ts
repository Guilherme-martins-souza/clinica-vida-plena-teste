// Chamadas à API do backend. O Vite repassa /api para o backend (ver vite.config.ts).

/** Objeto JSON qualquer: serve para conferir o formato do que a API devolveu. */
export type JsonObject = Record<string, unknown>

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Lê a mensagem do formato de erro da API: { error: { code, message } }. */
function mensagemDeErro(corpo: unknown): string | null {
  if (!isJsonObject(corpo) || !isJsonObject(corpo.error)) return null
  return typeof corpo.error.message === 'string' ? corpo.error.message : null
}

/**
 * GET em JSON. Devolve `unknown`: quem chama confere o formato.
 * Se a resposta não for 2xx, lança um Error com a mensagem que a API mandou.
 */
export async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  // Corpo vazio ou que não é JSON vira null.
  const corpo: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(mensagemDeErro(corpo) ?? `Erro ${res.status} ao acessar a API.`)
  }
  return corpo
}

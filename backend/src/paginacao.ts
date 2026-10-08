import { z } from 'zod';
import { HttpError } from './errors';

// Paginação das listas da API: ?pagina=1&porPagina=10 (padrão de 10 em 10, no máximo 100).
// Toda lista responde no formato { itens, total, pagina, porPagina }.

export const POR_PAGINA_PADRAO = 10;
export const POR_PAGINA_MAXIMO = 100;

const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(POR_PAGINA_MAXIMO).default(POR_PAGINA_PADRAO),
});

export type Paginacao = z.infer<typeof paginacaoSchema>;

export interface Pagina<T> extends Paginacao {
  itens: T[];
  total: number;
}

/** Lê pagina e porPagina da query string; valores inválidos respondem 400. */
export function lerPaginacao(query: unknown): Paginacao {
  const resultado = paginacaoSchema.safeParse(query);
  if (!resultado.success) {
    throw new HttpError(
      400,
      'PAGINACAO_INVALIDA',
      `pagina deve ser um inteiro a partir de 1 e porPagina um inteiro de 1 a ${POR_PAGINA_MAXIMO}`,
    );
  }
  return resultado.data;
}

/** Quantos itens pular para chegar na página pedida. */
export function inicioDaPagina({ pagina, porPagina }: Paginacao): number {
  return (pagina - 1) * porPagina;
}

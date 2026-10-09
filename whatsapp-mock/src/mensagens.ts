import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from './errors';

const mensagemSchema = z.object({
  to: z.string().trim().min(1, 'to é obrigatório'),
  tipo: z.string().trim().min(1, 'tipo é obrigatório'),
  text: z.string().trim().min(1, 'text é obrigatório'),
});

export type Mensagem = z.infer<typeof mensagemSchema> & { id: string; recebidaEm: Date };
export type GrupoTelefone = { telefone: string; mensagens: Mensagem[] };

// Fica só em memória: é uma demonstração, reiniciar o serviço apaga tudo.
const mensagens: Mensagem[] = [];

export function contarMensagens(): number {
  return mensagens.length;
}

export function limparMensagens(): void {
  mensagens.length = 0;
}

// Valida o corpo, guarda a mensagem e devolve o id gerado.
export function guardarMensagem(dados: unknown): { id: string } {
  const resultado = mensagemSchema.safeParse(dados);
  if (!resultado.success) {
    const problema = resultado.error.issues[0];
    const campo = problema.path.join('.') || 'corpo';
    throw new HttpError(400, 'VALIDATION_ERROR', `${campo}: ${problema.message}`);
  }
  const id = randomUUID();
  mensagens.push({ ...resultado.data, id, recebidaEm: new Date() });
  return { id };
}

// Um grupo por telefone (o de mensagem mais recente primeiro); dentro do grupo, a mensagem mais recente vem primeiro.
export function agruparPorTelefone(): GrupoTelefone[] {
  const grupos = new Map<string, Mensagem[]>();
  // Percorre do fim para o começo: a ordem de chegada é a ordem real, mesmo com datas iguais.
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    const lista = grupos.get(m.to) ?? [];
    lista.push(m);
    grupos.set(m.to, lista);
  }
  return [...grupos].map(([telefone, lista]) => ({ telefone, mensagens: lista }));
}

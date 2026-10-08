export type TipoMensagem = 'criada' | 'confirmacao' | 'lembrete';

export type Enviador = (mensagem: { to: string; tipo: TipoMensagem; text: string }) => Promise<void>;

// Envia para o whatsapp-mock (POST {baseUrl}/messages). Lança Error se a conexão falha, demora mais de 5 s ou não vem 2xx.
export function criarClienteWhatsapp(baseUrl: string): Enviador {
  return async (mensagem) => {
    const resposta = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mensagem),
      signal: AbortSignal.timeout(5000),
    });
    if (!resposta.ok) {
      throw new Error(`WhatsApp respondeu ${resposta.status}`);
    }
  };
}

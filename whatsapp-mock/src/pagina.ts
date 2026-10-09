import type { GrupoTelefone, Mensagem } from './mensagens';

function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatarData(data: Date): string {
  return data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Um item da lista da esquerda: o telefone e o começo da última mensagem. O chat aberto fica destacado.
function renderizarItemDaLista(grupo: GrupoTelefone, aberto: boolean, busca: string): string {
  const ultima = grupo.mensagens[0];
  const previa = ultima.text.length > 40 ? `${ultima.text.slice(0, 40)}…` : ultima.text;
  return `
        <li>
          <a href="/?telefone=${encodeURIComponent(grupo.telefone)}${busca ? `&amp;q=${encodeURIComponent(busca)}` : ''}"${aberto ? ' class="aberto" aria-current="page"' : ''}>
            <strong>${escapar(grupo.telefone)}</strong>
            <span>${escapar(previa)}</span>
          </a>
        </li>`;
}

function renderizarBalao(m: Mensagem): string {
  return `
          <li>
            <small>${escapar(formatarData(m.recebidaEm))} - ${escapar(m.tipo)}</small>
            <p>${escapar(m.text)}</p>
          </li>`;
}

// O chat mostra as mensagens da mais antiga para a mais nova, como no WhatsApp.
function renderizarChat(grupo: GrupoTelefone | undefined): string {
  if (!grupo) return '<p class="vazio">Nenhuma mensagem recebida ainda.</p>';
  const baloes = [...grupo.mensagens].reverse().map(renderizarBalao).join('');
  return `
        <h2>${escapar(grupo.telefone)}</h2>
        <ul class="baloes">${baloes}
        </ul>`;
}

// Compara só os dígitos, então "(11) 99999-0001" encontra "5511999990001".
function soDigitos(texto: string): string {
  return texto.replaceAll(/\D/g, '');
}

function filtrarPorNumero(grupos: GrupoTelefone[], busca: string): GrupoTelefone[] {
  const digitos = soDigitos(busca);
  if (!digitos) return grupos;
  return grupos.filter((g) => soDigitos(g.telefone).includes(digitos));
}

// Página somente de leitura: sem formulário nem resposta, o paciente não "responde" no mock.
// Os chats são links (?telefone=...), então funciona sem JavaScript. Sem telefone na URL, abre o mais recente.
export function renderizarPagina(todos: GrupoTelefone[], telefone?: string, busca = ''): string {
  const grupos = filtrarPorNumero(todos, busca);
  const total = todos.reduce((soma, g) => soma + g.mensagens.length, 0);
  const aberto = grupos.find((g) => g.telefone === telefone) ?? grupos[0];
  const lista =
    grupos.length === 0 && busca
      ? '<li class="vazio">Nenhum chat com esse número.</li>'
      : grupos.map((g) => renderizarItemDaLista(g, g === aberto, busca)).join('');
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WhatsApp simulado</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: sans-serif; margin: 0; display: flex; height: 100vh; }
      nav { width: 20rem; flex-shrink: 0; border-right: 1px solid #ddd; overflow-y: auto; background: #fff; }
      nav h1 { font-size: 1.125rem; margin: 0; padding: 1rem; background: #075e54; color: #fff; }
      nav form { padding: 0.5rem; background: #f0f2f5; }
      nav input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 0.5rem; font: inherit; }
      nav ul { list-style: none; margin: 0; padding: 0; }
      nav a { display: block; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; color: inherit; text-decoration: none; }
      nav a:hover { background: #f5f5f5; }
      nav a.aberto { background: #e7f3ef; }
      nav a span { display: block; font-size: 0.875rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      main { flex: 1; overflow-y: auto; padding: 0 1rem 1rem; background: #efeae2; }
      main h2 { position: sticky; top: 0; margin: 0 -1rem 1rem; padding: 1rem; font-size: 1rem; background: #f0f2f5; }
      .baloes { list-style: none; padding: 0; margin: 0; }
      .baloes li { background: #dcf8c6; border-radius: 0.5rem; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; max-width: 32rem; margin-left: auto; }
      .baloes li p { margin: 0.25rem 0 0; white-space: pre-wrap; }
      nav li.vazio { padding: 1rem; }
      .vazio { padding: 1rem; color: #666; }
      @media (max-width: 45em) {
        body { flex-direction: column; height: auto; }
        nav { width: 100%; max-height: 40vh; border-right: 0; border-bottom: 1px solid #ddd; }
      }
    </style>
  </head>
  <body data-total="${total}">
    <nav aria-label="Chats">
      <h1>WhatsApp simulado</h1>
      <form method="get" action="/" role="search">
        <input type="search" name="q" value="${escapar(busca)}" placeholder="Buscar pelo número" aria-label="Buscar pelo número" />
      </form>
      <ul>${lista}
      </ul>
    </nav>
    <main>${renderizarChat(aberto)}
    </main>
    <script>
      // A cada 3 s pergunta quantas mensagens existem; se mudou, recarrega a página (a URL guarda o chat e a busca).
      // Não recarrega enquanto a pessoa digita na busca.
      const total = document.body.dataset.total
      setInterval(async () => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return
        try {
          const resposta = await fetch('/status')
          const dados = await resposta.json()
          if (String(dados.total) !== total) location.reload()
        } catch {
          // Serviço fora do ar por um instante: tenta de novo na próxima volta.
        }
      }, 3000)
    </script>
  </body>
</html>
`;
}

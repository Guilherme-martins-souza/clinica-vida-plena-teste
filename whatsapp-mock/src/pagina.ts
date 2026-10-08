import type { GrupoTelefone } from './mensagens';

function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderizarGrupo(grupo: GrupoTelefone): string {
  const itens = grupo.mensagens
    .map(
      (m) => `
      <li>
        <small>${escapar(m.recebidaEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))} - ${escapar(m.tipo)}</small>
        <p>${escapar(m.text)}</p>
      </li>`,
    )
    .join('');
  return `
    <section>
      <h2>${escapar(grupo.telefone)}</h2>
      <ul>${itens}
      </ul>
    </section>`;
}

// Página somente de leitura: sem formulário nem resposta, o paciente não "responde" no mock.
export function renderizarPagina(grupos: GrupoTelefone[]): string {
  const corpo = grupos.length === 0 ? '<p>Nenhuma mensagem recebida ainda.</p>' : grupos.map(renderizarGrupo).join('');
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WhatsApp simulado</title>
    <style>
      body { font-family: sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
      ul { list-style: none; padding: 0; }
      li { background: #dcf8c6; border-radius: 0.5rem; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; }
      li p { margin: 0.25rem 0 0; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>WhatsApp simulado</h1>${corpo}
  </body>
</html>
`;
}

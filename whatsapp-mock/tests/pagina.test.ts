import { describe, expect, it } from 'vitest';
import { renderizarPagina } from '../src/pagina';
import type { GrupoTelefone } from '../src/mensagens';

const grupo = (text: string): GrupoTelefone => ({
  telefone: '5511999990001',
  mensagens: [
    { id: '1', to: '5511999990001', tipo: 'confirmacao', text, recebidaEm: new Date('2026-10-08T12:00:00Z') },
  ],
});

describe('renderizarPagina', () => {
  it('mostra telefone, tipo e texto', () => {
    const html = renderizarPagina([grupo('Sua consulta é amanhã')]);
    expect(html).toContain('5511999990001');
    expect(html).toContain('confirmacao');
    expect(html).toContain('Sua consulta é amanhã');
  });

  it('escapa o texto', () => {
    const html = renderizarPagina([grupo('<script>alert(1)</script>')]);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('não tem formulário, campo nem botão', () => {
    const html = renderizarPagina([grupo('oi')]);
    expect(html).not.toMatch(/<(form|input|button|textarea)/i);
  });

  it('sem mensagens mostra um texto vazio claro', () => {
    expect(renderizarPagina([])).toContain('Nenhuma mensagem recebida ainda.');
  });
});

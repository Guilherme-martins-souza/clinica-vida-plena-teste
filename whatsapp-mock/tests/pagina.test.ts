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

  it('não tem campo de resposta: só a busca de número', () => {
    const html = renderizarPagina([grupo('oi')]);
    expect(html).not.toMatch(/<(button|textarea)/i);
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toContain('type="search"');
  });

  it('sem mensagens mostra um texto vazio claro', () => {
    expect(renderizarPagina([])).toContain('Nenhuma mensagem recebida ainda.');
  });
});

describe('renderizarPagina com vários chats', () => {
  const outro: GrupoTelefone = {
    telefone: '5511999990002',
    mensagens: [{ id: '2', to: '5511999990002', tipo: 'lembrete', text: 'Lembrete do outro', recebidaEm: new Date() }],
  };

  it('lista um chat por telefone, com link', () => {
    const html = renderizarPagina([grupo('oi'), outro]);
    expect(html).toContain('href="/?telefone=5511999990001"');
    expect(html).toContain('href="/?telefone=5511999990002"');
  });

  it('abre o chat do telefone escolhido e só as mensagens dele', () => {
    const html = renderizarPagina([grupo('Mensagem do primeiro'), outro], '5511999990002');
    expect(html).toContain('<h2>5511999990002</h2>');
    expect(html).not.toContain('<h2>5511999990001</h2>');
    expect(html).toContain('Lembrete do outro');
  });

  it('sem telefone na URL abre o primeiro (mais recente)', () => {
    const html = renderizarPagina([grupo('oi'), outro]);
    expect(html).toContain('<h2>5511999990001</h2>');
  });

  it('mostra as mensagens da mais antiga para a mais nova', () => {
    const g: GrupoTelefone = {
      telefone: '5511999990001',
      mensagens: [
        { id: '2', to: '5511999990001', tipo: 'lembrete', text: 'segunda', recebidaEm: new Date() },
        { id: '1', to: '5511999990001', tipo: 'confirmacao', text: 'primeira', recebidaEm: new Date() },
      ],
    };
    const html = renderizarPagina([g]);
    const chat = html.slice(html.indexOf('<main>'));
    expect(chat.indexOf('primeira')).toBeLessThan(chat.indexOf('segunda'));
  });
});

describe('busca por número', () => {
  const g = (telefone: string): GrupoTelefone => ({
    telefone,
    mensagens: [{ id: telefone, to: telefone, tipo: 'lembrete', text: `para ${telefone}`, recebidaEm: new Date() }],
  });

  it('lista só os chats que contêm os dígitos digitados', () => {
    const html = renderizarPagina([g('5511999990001'), g('5551973652906')], undefined, '(51) 97365');
    expect(html).toContain('<h2>5551973652906</h2>');
    expect(html).not.toContain('5511999990001');
  });

  it('mantém o texto digitado no campo e avisa quando nada bate', () => {
    const html = renderizarPagina([g('5511999990001')], undefined, '777');
    expect(html).toContain('value="777"');
    expect(html).toContain('Nenhum chat com esse número.');
  });
});

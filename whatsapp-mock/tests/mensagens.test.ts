import { beforeEach, describe, expect, it } from 'vitest';
import { agruparPorTelefone, guardarMensagem, limparMensagens } from '../src/mensagens';
import { HttpError } from '../src/errors';

const valida = { to: '5511999990001', tipo: 'confirmacao', text: 'Olá' };

describe('guardarMensagem', () => {
  beforeEach(limparMensagens);

  it('devolve um id para uma mensagem válida', () => {
    expect(guardarMensagem(valida).id).toEqual(expect.any(String));
  });

  it.each(['to', 'tipo', 'text'])('rejeita %s ausente', (campo) => {
    const dados: Record<string, string> = { ...valida };
    delete dados[campo];
    expect(() => guardarMensagem(dados)).toThrow(HttpError);
  });

  it.each(['to', 'tipo', 'text'])('rejeita %s vazio ou só com espaços', (campo) => {
    expect(() => guardarMensagem({ ...valida, [campo]: '   ' })).toThrow(HttpError);
  });

  it('rejeita corpo que não é objeto', () => {
    expect(() => guardarMensagem(undefined)).toThrow(HttpError);
  });
});

describe('agruparPorTelefone', () => {
  beforeEach(limparMensagens);

  it('devolve lista vazia sem mensagens', () => {
    expect(agruparPorTelefone()).toEqual([]);
  });

  it('agrupa por telefone com a mais recente primeiro', () => {
    guardarMensagem({ ...valida, text: 'primeira' });
    guardarMensagem({ ...valida, to: '5511999990002', text: 'outro' });
    guardarMensagem({ ...valida, text: 'segunda' });

    const grupos = agruparPorTelefone();
    expect(grupos.map((g) => g.telefone)).toEqual(['5511999990001', '5511999990002']);
    const doPrimeiro = grupos.find((g) => g.telefone === '5511999990001');
    expect(doPrimeiro?.mensagens.map((m) => m.text)).toEqual(['segunda', 'primeira']);
  });
});

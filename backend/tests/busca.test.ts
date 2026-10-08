import { describe, expect, it } from 'vitest';
import { regexDeBusca } from '../src/busca';

describe('regexDeBusca', () => {
  it('sem acento encontra o nome com acento, por trecho', () => {
    expect(regexDeBusca('joao').test('João Pedro')).toBe(true);
  });

  it('não diferencia maiúsculas', () => {
    expect(regexDeBusca('MARIA').test('maria')).toBe(true);
  });

  it('com acento encontra o nome sem acento', () => {
    expect(regexDeBusca('conceição').test('Conceicao')).toBe(true);
  });

  it('escapa caracteres especiais', () => {
    expect(regexDeBusca('a.b').test('axb')).toBe(false);
    expect(regexDeBusca('a.b').test('a.b')).toBe(true);
  });

  it('não casa nome sem o trecho', () => {
    expect(regexDeBusca('joao').test('Maria Silva')).toBe(false);
  });
});

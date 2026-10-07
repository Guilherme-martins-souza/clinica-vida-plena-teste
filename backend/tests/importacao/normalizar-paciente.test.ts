import { describe, expect, it } from 'vitest';
import { escolherNome, limparNome, normalizarTelefone } from '../../src/importacao/normalizar';

describe('normalizarTelefone', () => {
  it.each(['(53) 94895-4499', '53948954499', '+55 53 94895-4499'])('%j vira só dígitos com DDD, sem +55', (texto) => {
    expect(normalizarTelefone(texto)).toEqual({ telefone: '53948954499', invalido: false });
  });

  it('aceita telefone fixo com 10 dígitos', () => {
    expect(normalizarTelefone('5332221111')).toEqual({ telefone: '5332221111', invalido: false });
  });

  it.each(['92916', '519405', '(53) 9999-', 'sem telefone'])('%j fica sem telefone e marcado inválido', (texto) => {
    expect(normalizarTelefone(texto)).toEqual({ telefone: null, invalido: true });
  });

  it('vazio continua vazio, sem ser inválido', () => {
    expect(normalizarTelefone('')).toEqual({ telefone: null, invalido: false });
  });
});

describe('limparNome', () => {
  it('remove espaços repetidos e das pontas', () => {
    expect(limparNome('Daniel  Moura Monteiro ')).toBe('Daniel Moura Monteiro');
  });
});

describe('escolherNome', () => {
  it('escolhe a grafia mais frequente', () => {
    expect(
      escolherNome([
        { nome: 'ANA LIMA', linha: 2 },
        { nome: 'Ana Lima', linha: 5 },
        { nome: 'ANA LIMA', linha: 9 },
      ]),
    ).toBe('ANA LIMA');
  });

  it('no empate, prefere a que não está toda em maiúsculas', () => {
    expect(
      escolherNome([
        { nome: 'ANA LIMA', linha: 2 },
        { nome: 'Ana Lima', linha: 5 },
      ]),
    ).toBe('Ana Lima');
  });

  it('no empate entre duas grafias normais, fica a que aparece primeiro no arquivo', () => {
    expect(
      escolherNome([
        { nome: 'Ana de Lima', linha: 8 },
        { nome: 'Ana De Lima', linha: 3 },
      ]),
    ).toBe('Ana De Lima');
  });
});

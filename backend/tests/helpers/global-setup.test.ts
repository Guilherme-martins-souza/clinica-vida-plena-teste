import { describe, expect, it } from 'vitest';
import { bancosDeTeste } from './global-setup';

describe('bancosDeTeste', () => {
  it('escolhe só os bancos que começam com clinica_test', () => {
    expect(bancosDeTeste(['clinica', 'clinica_test', 'clinica_test_x', 'admin', 'outra_clinica_test'])).toEqual([
      'clinica_test',
      'clinica_test_x',
    ]);
  });
});

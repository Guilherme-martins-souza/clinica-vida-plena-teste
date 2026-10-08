import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { proximaDaEspera } from '../../src/lista-espera/proxima';
import { ListaEspera } from '../../src/models/lista-espera';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

function pessoa(nome: string, medicoId: string | null, criadoEm: string) {
  return { nome, telefone: '11955550000', medicoId, criadoEm: new Date(criadoEm) };
}

beforeAll(async () => {
  await conectarBancoDeTeste('lista_espera_proxima');
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('proximaDaEspera', () => {
  it('devolve a mais antiga entre as elegíveis (médico igual ou sem médico)', async () => {
    await ListaEspera.create([
      pessoa('Terceira', 'MED01', '2026-10-03T10:00:00Z'),
      pessoa('Primeira', null, '2026-10-01T10:00:00Z'),
      pessoa('Segunda', 'MED01', '2026-10-02T10:00:00Z'),
    ]);

    expect((await proximaDaEspera('MED01'))?.nome).toBe('Primeira');
  });

  it('prefere o médico igual quando ele é mais antigo que quem aceita qualquer um', async () => {
    await ListaEspera.create([
      pessoa('Qualquer', null, '2026-10-02T10:00:00Z'),
      pessoa('Do médico', 'MED01', '2026-10-01T10:00:00Z'),
    ]);

    expect((await proximaDaEspera('MED01'))?.nome).toBe('Do médico');
  });

  it('ignora quem espera outro médico', async () => {
    await ListaEspera.create([
      pessoa('Outro médico', 'MED02', '2026-10-01T10:00:00Z'),
      pessoa('Sem médico', null, '2026-10-05T10:00:00Z'),
    ]);

    expect((await proximaDaEspera('MED01'))?.nome).toBe('Sem médico');
  });

  it('só com gente de outro médico devolve null', async () => {
    await ListaEspera.create([pessoa('Outro médico', 'MED02', '2026-10-01T10:00:00Z')]);

    expect(await proximaDaEspera('MED01')).toBeNull();
  });

  it('lista vazia devolve null', async () => {
    expect(await proximaDaEspera('MED01')).toBeNull();
  });
});

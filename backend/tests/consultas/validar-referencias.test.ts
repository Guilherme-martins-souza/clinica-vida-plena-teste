import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validarReferencias } from '../../src/consultas/validar-referencias';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

beforeAll(async () => {
  await conectarBancoDeTeste('consultas_validar_referencias');
  await limparBanco();
  await Medico.create([
    { _id: 'MED01', nome: 'Dra. Ana', especialidade: 'Cardiologia', grade: [] },
    { _id: 'MED02', nome: 'Dr. Bruno', especialidade: 'Pediatria', grade: [] },
  ]);
  await Paciente.create([
    { _id: 'PAC0001', nome: 'Carla', telefone: null },
    { _id: 'PAC0002', nome: 'Diego', telefone: null },
  ]);
});

afterEach(() => {
  mongoose.set('debug', false);
});

afterAll(async () => {
  await desconectar();
});

describe('validarReferencias', () => {
  it('passa quando todos os médicos e pacientes existem', async () => {
    await expect(
      validarReferencias([
        { medicoId: 'MED01', pacienteId: 'PAC0001' },
        { medicoId: 'MED02', pacienteId: 'PAC0002' },
      ]),
    ).resolves.toBeUndefined();
  });

  it('lança listando o médico inexistente', async () => {
    const erro = validarReferencias([
      { medicoId: 'MED01', pacienteId: 'PAC0001' },
      { medicoId: 'MED99', pacienteId: 'PAC0002' },
    ]);

    await expect(erro).rejects.toThrow('Médico inexistente: MED99');
  });

  it('lança listando o paciente inexistente', async () => {
    const erro = validarReferencias([
      { medicoId: 'MED01', pacienteId: 'PAC0001' },
      { medicoId: 'MED02', pacienteId: 'PAC9999' },
    ]);

    await expect(erro).rejects.toThrow('Paciente inexistente: PAC9999');
  });

  it('passa com a lista vazia', async () => {
    await expect(validarReferencias([])).resolves.toBeUndefined();
  });

  it('faz no máximo 2 consultas ao banco para 100 consultas', async () => {
    const consultas = Array.from({ length: 100 }, (_, i) => ({
      medicoId: i % 2 === 0 ? 'MED01' : 'MED02',
      pacienteId: i % 3 === 0 ? 'PAC0001' : 'PAC0002',
    }));

    // O modo debug do mongoose chama esta função a cada operação enviada ao banco.
    const operacoes: string[] = [];
    mongoose.set('debug', (colecao: string, metodo: string) => {
      operacoes.push(`${colecao}.${metodo}`);
    });

    await validarReferencias(consultas);

    expect(operacoes.length).toBeGreaterThan(0);
    expect(operacoes.length).toBeLessThanOrEqual(2);
  });
});

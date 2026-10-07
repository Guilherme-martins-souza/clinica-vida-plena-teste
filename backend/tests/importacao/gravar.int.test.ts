import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gravarDados, type DadosParaGravar } from '../../src/importacao/gravar';
import { Consulta, type DadosConsulta } from '../../src/models/consulta';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

function consulta(codigo: string, campos: Partial<DadosConsulta> = {}): DadosConsulta {
  return {
    codigoLegado: codigo,
    pacienteId: 'PAC0001',
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio: new Date('2026-09-28T11:00:00Z'),
    marcadaEm: new Date('2026-09-20T12:00:00Z'),
    canceladaEm: null,
    status: 'agendada',
    ...campos,
  };
}

function primeiraImportacao(): DadosParaGravar {
  return {
    medicos: [
      { _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: [] },
      { _id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia', grade: [] },
    ],
    pacientes: [
      { _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499' },
      { _id: 'PAC0002', nome: 'João Souza', telefone: null },
    ],
    consultas: [
      consulta('AG00001'),
      consulta('AG00002', { pacienteId: 'PAC0002', medicoId: 'MED02', status: 'realizada' }),
    ],
  };
}

function segundaImportacao(): DadosParaGravar {
  return {
    medicos: [{ _id: 'MED03', nome: 'Dr. Carlos Lima', especialidade: 'Pediatria', grade: [] }],
    pacientes: [{ _id: 'PAC0003', nome: 'Ana Costa', telefone: null }],
    consultas: [consulta('AG00010', { pacienteId: 'PAC0003', medicoId: 'MED03' })],
  };
}

// Foto do banco, para comparar antes e depois de uma gravação que falha.
async function estadoDoBanco() {
  return {
    medicos: await Medico.find().sort({ _id: 1 }).lean(),
    pacientes: await Paciente.find().sort({ _id: 1 }).lean(),
    consultas: await Consulta.find().sort({ codigoLegado: 1 }).lean(),
  };
}

beforeAll(async () => {
  await conectarBancoDeTeste('importacao_gravar');
  await Promise.all([Medico.init(), Paciente.init(), Consulta.init()]);
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('gravarDados', () => {
  it('grava médicos, pacientes e consultas', async () => {
    await gravarDados(primeiraImportacao());

    const estado = await estadoDoBanco();
    expect(estado.medicos.map((medico) => medico._id)).toEqual(['MED01', 'MED02']);
    expect(estado.pacientes).toEqual([
      { _id: 'PAC0001', nome: 'Maria Silva', telefone: '53948954499', __v: 0 },
      { _id: 'PAC0002', nome: 'João Souza', telefone: null, __v: 0 },
    ]);
    expect(estado.consultas).toHaveLength(2);
    expect(estado.consultas[1]).toMatchObject({
      codigoLegado: 'AG00002',
      pacienteId: 'PAC0002',
      medicoId: 'MED02',
      status: 'realizada',
      inicio: new Date('2026-09-28T11:00:00Z'),
    });
  });

  it('uma segunda gravação substitui tudo, inclusive consulta criada fora da importação', async () => {
    await gravarDados(primeiraImportacao());
    await Consulta.create(consulta('', { codigoLegado: null, inicio: new Date('2026-09-28T12:00:00Z') }));
    expect(await Consulta.countDocuments()).toBe(3);

    await gravarDados(segundaImportacao());

    const estado = await estadoDoBanco();
    expect(estado.medicos.map((medico) => medico._id)).toEqual(['MED03']);
    expect(estado.pacientes.map((paciente) => paciente._id)).toEqual(['PAC0003']);
    expect(estado.consultas.map((c) => c.codigoLegado)).toEqual(['AG00010']);
  });

  it('com uma consulta inválida no meio (minuto 15), nada muda', async () => {
    await gravarDados(primeiraImportacao());
    const antes = await estadoDoBanco();

    const dados = segundaImportacao();
    dados.consultas = [
      consulta('AG00010', { pacienteId: 'PAC0003', medicoId: 'MED03' }),
      consulta('AG00011', { pacienteId: 'PAC0003', medicoId: 'MED03', inicio: new Date('2026-09-28T11:15:00Z') }),
      consulta('AG00012', { pacienteId: 'PAC0003', medicoId: 'MED03', inicio: new Date('2026-09-28T12:00:00Z') }),
    ];

    await expect(gravarDados(dados)).rejects.toThrow('A consulta precisa começar no minuto 00 ou 30');
    expect(await estadoDoBanco()).toEqual(antes);
  });

  it('com consulta apontando para paciente inexistente, nada muda', async () => {
    await gravarDados(primeiraImportacao());
    const antes = await estadoDoBanco();

    const dados = segundaImportacao();
    dados.consultas.push(consulta('AG00011', { pacienteId: 'PAC9999', medicoId: 'MED03' }));

    await expect(gravarDados(dados)).rejects.toThrow('Paciente inexistente: PAC9999');
    expect(await estadoDoBanco()).toEqual(antes);
  });
});

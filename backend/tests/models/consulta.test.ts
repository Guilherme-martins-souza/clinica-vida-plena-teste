import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Consulta, STATUS_CONSULTA, TIPOS_ATENDIMENTO, type DadosConsulta } from '../../src/models/consulta';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

function consultaValida(): DadosConsulta {
  return {
    codigoLegado: 'AG00001',
    pacienteId: 'PAC0050',
    medicoId: 'MED01',
    tipoAtendimento: 'convenio',
    inicio: new Date('2025-09-26T10:00:00-03:00'),
    marcadaEm: null,
    canceladaEm: null,
    status: 'agendada',
    consideradoFalta: false,
  };
}

// Tenta gravar e devolve o caminho dos campos recusados pela validação.
async function camposRecusados(dados: DadosConsulta): Promise<string[]> {
  try {
    await Consulta.create(dados);
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return Object.keys(err.errors);
    }
    throw err;
  }
  return [];
}

beforeAll(async () => {
  await conectarBancoDeTeste('models_consulta');
  await Consulta.init();
});

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await desconectar();
});

describe('model Consulta', () => {
  it('grava consulta válida com marcadaEm e canceladaEm nulos', async () => {
    const criada = await Consulta.create(consultaValida());

    const salva = await Consulta.findById(criada._id).lean();
    expect(salva).toMatchObject({
      codigoLegado: 'AG00001',
      pacienteId: 'PAC0050',
      medicoId: 'MED01',
      tipoAtendimento: 'convenio',
      inicio: new Date('2025-09-26T13:00:00Z'),
      marcadaEm: null,
      canceladaEm: null,
      status: 'agendada',
    });
    expect(salva?.createdAt).toBeInstanceOf(Date);
    expect(salva?.updatedAt).toBeInstanceOf(Date);
  });

  it('consulta nova sem consideradoFalta grava false (CAMPO-01 AC 1)', async () => {
    const { consideradoFalta: _ignorado, ...semCampo } = consultaValida();

    const criada = await Consulta.create(semCampo);

    const salva = await Consulta.findById(criada._id).lean();
    expect(salva?.consideradoFalta).toBe(false);
  });

  it('aceita exatamente os 6 status e os 2 tipos de atendimento', () => {
    expect([...STATUS_CONSULTA].sort()).toEqual(
      ['agendada', 'confirmada', 'realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'].sort(),
    );
    expect([...TIPOS_ATENDIMENTO].sort()).toEqual(['convenio', 'particular']);
  });

  it('recusa status fora da lista', async () => {
    const dados = { ...consultaValida(), status: 'cancelado' as DadosConsulta['status'] };
    expect(await camposRecusados(dados)).toContain('status');
  });

  it('recusa tipo de atendimento fora da lista', async () => {
    const dados = {
      ...consultaValida(),
      tipoAtendimento: 'sus' as DadosConsulta['tipoAtendimento'],
    };
    expect(await camposRecusados(dados)).toContain('tipoAtendimento');
  });

  it('recusa início fora do slot de 30 minutos', async () => {
    const as1015 = { ...consultaValida(), inicio: new Date('2025-09-26T10:15:00-03:00') };
    expect(await camposRecusados(as1015)).toContain('inicio');

    const comSegundos = { ...consultaValida(), inicio: new Date('2025-09-26T10:00:30-03:00') };
    expect(await camposRecusados(comSegundos)).toContain('inicio');

    expect(await Consulta.countDocuments()).toBe(0);
  });

  it('aceita início no minuto 30', async () => {
    const as1030 = { ...consultaValida(), inicio: new Date('2025-09-26T10:30:00-03:00') };
    expect(await camposRecusados(as1030)).toEqual([]);
  });

  it('grava duas consultas sem codigoLegado', async () => {
    await Consulta.create({ ...consultaValida(), codigoLegado: null });
    await Consulta.create({ ...consultaValida(), codigoLegado: null, pacienteId: 'PAC0051' });

    expect(await Consulta.countDocuments({ codigoLegado: null })).toBe(2);
  });

  it('recusa duas consultas com o mesmo codigoLegado', async () => {
    await Consulta.create(consultaValida());

    await expect(Consulta.create({ ...consultaValida(), pacienteId: 'PAC0051' })).rejects.toMatchObject({
      code: 11000,
    });
    expect(await Consulta.countDocuments()).toBe(1);
  });

  it('tem os índices de busca por médico, paciente e data e o codigoLegado único parcial', async () => {
    const indices = await Consulta.collection.listIndexes().toArray();
    const chaves = indices.map((indice) => indice.key);

    expect(chaves).toContainEqual({ medicoId: 1, inicio: 1 });
    expect(chaves).toContainEqual({ pacienteId: 1, inicio: 1 });
    expect(chaves).toContainEqual({ inicio: 1 });

    const codigo = indices.find((indice) => indice.key.codigoLegado === 1);
    expect(codigo?.unique).toBe(true);
    expect(codigo?.partialFilterExpression).toEqual({ codigoLegado: { $type: 'string' } });
  });
});

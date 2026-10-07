import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ImportacaoEmAndamentoError,
  executarImportacao,
  importarSeNecessario,
  marcarInterrompidas,
} from '../../src/importacao/executar';
import { Consulta } from '../../src/models/consulta';
import { Importacao, type DadosImportacao } from '../../src/models/importacao';
import { Medico } from '../../src/models/medico';
import { Paciente } from '../../src/models/paciente';
import { conectarBancoDeTeste, desconectar, limparBanco } from '../helpers/mongo';

const MEDICOS_JSON = JSON.stringify([
  {
    id: 'MED01',
    nome: 'Dr. Paulo Mendes',
    especialidade: 'Cardiologia',
    grade: [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }],
  },
]);

// 21/09/2026 e 28/09/2026 são segundas; 29/09/2026 é terça.
// Linha 2: passada e realizada, sem correção.
// Linha 3: idêntica à 2 → duplicada.
// Linha 4: futura, data_agendamento no formato DD/MM/AAAA (a maior: data de referência) → data_formato.
// Linha 5: terça, fora da grade do MED01 → fora_da_grade.
const AGENDAMENTOS_CSV = [
  'id,paciente_id,paciente_nome,paciente_telefone,tipo_atendimento,medico_id,data_agendamento,data_consulta,status',
  'AG00001,PAC0001,Maria Silva,53948954499,convenio,MED01,2026-09-01 10:00,2026-09-21 08:00,realizada',
  'AG00001,PAC0001,Maria Silva,53948954499,convenio,MED01,2026-09-01 10:00,2026-09-21 08:00,realizada',
  'AG00002,PAC0001,Maria Silva,53948954499,convenio,MED01,24/09/2026 17:42,2026-09-28 08:00,agendada',
  'AG00003,PAC0001,Maria Silva,53948954499,convenio,MED01,2026-09-02 10:00,2026-09-29 08:00,agendada',
  '',
].join('\n');

let dataDir: string;

async function existe(caminho: string): Promise<boolean> {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

// Foto dos dados importados, para conferir que uma importação que falhou não mexeu neles.
async function dadosDoBanco() {
  return {
    medicos: await Medico.find().sort({ _id: 1 }).lean(),
    pacientes: await Paciente.find().sort({ _id: 1 }).lean(),
    consultas: await Consulta.find().sort({ codigoLegado: 1 }).lean(),
  };
}

function importacaoRegistrada(campos: Partial<DadosImportacao>): Partial<DadosImportacao> {
  return { origem: 'automatica', iniciadaEm: new Date('2026-10-01T12:00:00Z'), ...campos };
}

beforeAll(async () => {
  await conectarBancoDeTeste('importacao_executar');
  await Promise.all([Medico.init(), Paciente.init(), Consulta.init(), Importacao.init()]);
});

beforeEach(async () => {
  await limparBanco();
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'executar-'));
  await writeFile(path.join(dataDir, 'medicos.json'), MEDICOS_JSON);
  await writeFile(path.join(dataDir, 'agendamentos.csv'), AGENDAMENTOS_CSV);
  // O resumo vai para o terminal; nos testes ele não precisa aparecer.
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dataDir, { recursive: true, force: true });
});

afterAll(async () => {
  await desconectar();
});

describe('executarImportacao', () => {
  it('termina concluida com totais, contagens, descartes, data de referência, fim e arquivos', async () => {
    const importacao = await executarImportacao({ origem: 'manual', dataDir });

    const salva = await Importacao.findById(importacao._id).lean();
    expect(salva).toMatchObject({
      origem: 'manual',
      situacao: 'concluida',
      erro: null,
      dataReferencia: new Date('2026-09-24T20:42:00Z'),
      totais: { lidas: 4, importadas: 2, corrigidas: 1, descartadas: 2, medicos: 1, pacientes: 1 },
      descartesPorMotivo: { duplicada: 1, fora_da_grade: 1 },
      correcoesPorTipo: { data_formato: 1 },
      slotsDuplos: [],
    });
    expect(salva?.descartes.map(({ linha, codigo, motivo }) => ({ linha, codigo, motivo }))).toEqual([
      { linha: 3, codigo: 'AG00001', motivo: 'duplicada' },
      { linha: 5, codigo: 'AG00003', motivo: 'fora_da_grade' },
    ]);
    expect(salva?.descartes[1].valores).toMatchObject({ id: 'AG00003', data_consulta: '2026-09-29 08:00' });
    expect(salva?.finalizadaEm).toBeInstanceOf(Date);
    expect(salva?.finalizadaEm?.getTime()).toBeGreaterThanOrEqual(salva?.iniciadaEm.getTime() ?? Infinity);

    expect(path.dirname(salva?.arquivos?.json ?? '')).toBe(path.join(dataDir, 'relatorios'));
    expect(await existe(salva?.arquivos?.json ?? '')).toBe(true);
    expect(await existe(salva?.arquivos?.csv ?? '')).toBe(true);

    expect((await Consulta.find().sort({ codigoLegado: 1 }).lean()).map((c) => c.codigoLegado)).toEqual([
      'AG00001',
      'AG00002',
    ]);
    expect(await Medico.countDocuments()).toBe(1);
    expect(await Paciente.countDocuments()).toBe(1);
  });

  it('com o medicos.json ausente termina falhou com a mensagem e não mexe nos dados', async () => {
    await executarImportacao({ origem: 'automatica', dataDir });
    const antes = await dadosDoBanco();
    await rm(path.join(dataDir, 'medicos.json'));

    const importacao = await executarImportacao({ origem: 'manual', dataDir });

    const salva = await Importacao.findById(importacao._id).lean();
    expect(salva?.situacao).toBe('falhou');
    expect(salva?.erro).toBe(`Não foi possível ler o arquivo ${path.join(dataDir, 'medicos.json')}`);
    expect(salva?.finalizadaEm).toBeInstanceOf(Date);
    expect(await dadosDoBanco()).toEqual(antes);
  });

  it('recusa com "Já existe uma importação em andamento" quando há outra em andamento', async () => {
    await Importacao.create(importacaoRegistrada({ situacao: 'em_andamento' }));

    const tentativa = executarImportacao({ origem: 'manual', dataDir });

    await expect(tentativa).rejects.toBeInstanceOf(ImportacaoEmAndamentoError);
    await expect(tentativa).rejects.toThrow('Já existe uma importação em andamento');
    expect(await Importacao.countDocuments()).toBe(1);
    expect(await Consulta.countDocuments()).toBe(0);
  });

  it('duas importações seguidas dos mesmos arquivos têm os mesmos totais e descartes', async () => {
    const primeira = await executarImportacao({ origem: 'automatica', dataDir });
    const segunda = await executarImportacao({ origem: 'manual', dataDir });

    const [a, b] = await Promise.all([
      Importacao.findById(primeira._id).lean(),
      Importacao.findById(segunda._id).lean(),
    ]);
    expect(b?.totais).toEqual(a?.totais);
    expect(b?.descartesPorMotivo).toEqual(a?.descartesPorMotivo);
    expect(b?.correcoesPorTipo).toEqual(a?.correcoesPorTipo);
    expect(b?.descartes).toEqual(a?.descartes);
    expect(await Importacao.countDocuments({ situacao: 'concluida' })).toBe(2);
  });

  it('sem conseguir escrever a pasta de relatórios, termina concluida com arquivos nulo', async () => {
    // Um arquivo comum com o nome da pasta impede criá-la (funciona mesmo rodando como root).
    await writeFile(path.join(dataDir, 'relatorios'), 'não é uma pasta');

    const importacao = await executarImportacao({ origem: 'manual', dataDir });

    const salva = await Importacao.findById(importacao._id).lean();
    expect(salva?.situacao).toBe('concluida');
    expect(salva?.arquivos).toBeNull();
    expect(salva?.totais?.importadas).toBe(2);
  });
});

describe('importarSeNecessario', () => {
  it('não importa quando já existe importação concluida', async () => {
    await Importacao.create(importacaoRegistrada({ situacao: 'concluida' }));

    await importarSeNecessario(dataDir);

    expect(await Importacao.countDocuments()).toBe(1);
    expect(await Consulta.countDocuments()).toBe(0);
  });

  it('importa (origem automatica) quando só existe importação que falhou', async () => {
    await Importacao.create(importacaoRegistrada({ situacao: 'falhou', erro: 'Importação interrompida' }));

    await importarSeNecessario(dataDir);

    const concluidas = await Importacao.find({ situacao: 'concluida' }).lean();
    expect(concluidas).toHaveLength(1);
    expect(concluidas[0].origem).toBe('automatica');
    expect(await Consulta.countDocuments()).toBe(2);
  });
});

describe('marcarInterrompidas', () => {
  it('muda importações em_andamento para falhou com "Importação interrompida"', async () => {
    const presa = await Importacao.create(importacaoRegistrada({ situacao: 'em_andamento' }));
    const concluida = await Importacao.create(importacaoRegistrada({ situacao: 'concluida' }));

    await marcarInterrompidas();

    const depois = await Importacao.findById(presa._id).lean();
    expect(depois?.situacao).toBe('falhou');
    expect(depois?.erro).toBe('Importação interrompida');
    expect((await Importacao.findById(concluida._id).lean())?.situacao).toBe('concluida');
  });
});

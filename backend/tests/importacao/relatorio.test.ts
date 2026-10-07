import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { montarCsvDescartes, resumoTerminal, salvarArquivos } from '../../src/importacao/relatorio';
import type { DadosImportacao, Descarte } from '../../src/models/importacao';

const CABECALHO =
  'linha,motivo,id,paciente_id,paciente_nome,paciente_telefone,tipo_atendimento,medico_id,data_agendamento,data_consulta,status';

function descarte(linha: number, campos: Partial<Descarte['valores']> = {}): Descarte {
  return {
    linha,
    codigo: campos.id ?? `AG${linha}`,
    motivo: 'fora_da_grade',
    valores: {
      id: `AG${linha}`,
      paciente_id: 'PAC0050',
      paciente_nome: 'Daniel Moura',
      paciente_telefone: '53948954499',
      tipo_atendimento: 'convenio',
      medico_id: 'MED01',
      data_agendamento: '2025-08-12 12:48',
      data_consulta: '2025-09-26 10:00',
      status: 'falta',
      ...campos,
    },
  };
}

function importacao(campos: Partial<DadosImportacao> = {}): DadosImportacao {
  return {
    origem: 'manual',
    situacao: 'concluida',
    // 07/10/2026 09:05:03 em São Paulo
    iniciadaEm: new Date('2026-10-07T12:05:03Z'),
    finalizadaEm: new Date('2026-10-07T12:05:09Z'),
    erro: null,
    dataReferencia: new Date('2026-09-24T20:42:00Z'),
    totais: { lidas: 7359, importadas: 7153, corrigidas: 4612, descartadas: 206, medicos: 6, pacientes: 1616 },
    descartesPorMotivo: { passada_sem_resultado: 69, duplicada: 40, fora_da_grade: 18 },
    correcoesPorTipo: { data_formato: 1900 },
    slotsDuplos: [],
    descartes: [descarte(2), descarte(5)],
    arquivos: null,
    ...campos,
  };
}

describe('montarCsvDescartes', () => {
  it('começa com o cabeçalho linha,motivo e as 9 colunas e traz uma linha por descarte', () => {
    const csv = montarCsvDescartes([descarte(2), descarte(5)]);

    expect(csv.split('\n')).toEqual([
      CABECALHO,
      '2,fora_da_grade,AG2,PAC0050,Daniel Moura,53948954499,convenio,MED01,2025-08-12 12:48,2025-09-26 10:00,falta',
      '5,fora_da_grade,AG5,PAC0050,Daniel Moura,53948954499,convenio,MED01,2025-08-12 12:48,2025-09-26 10:00,falta',
      '',
    ]);
  });

  it('coloca entre aspas, com aspas dobradas, os valores com vírgula, aspas ou quebra de linha', () => {
    const csv = montarCsvDescartes([
      descarte(3, { paciente_nome: 'Moura, Daniel', status: 'disse "talvez"', paciente_telefone: 'linha1\nlinha2' }),
    ]);

    expect(csv).toBe(
      `${CABECALHO}\n` +
        '3,fora_da_grade,AG3,PAC0050,"Moura, Daniel","linha1\nlinha2",convenio,MED01,2025-08-12 12:48,2025-09-26 10:00,"disse ""talvez"""\n',
    );
  });

  it('com a lista vazia gera só o cabeçalho', () => {
    expect(montarCsvDescartes([])).toBe(`${CABECALHO}\n`);
  });
});

describe('salvarArquivos', () => {
  let pastaTemporaria: string | undefined;

  afterEach(async () => {
    if (pastaTemporaria) {
      await rm(pastaTemporaria, { recursive: true, force: true });
    }
  });

  it('cria a pasta e grava o JSON e o CSV com a data e hora de São Paulo no nome', async () => {
    pastaTemporaria = await mkdtemp(path.join(os.tmpdir(), 'relatorio-'));
    const pasta = path.join(pastaTemporaria, 'relatorios', 'novos');
    const dados = importacao();

    const arquivos = await salvarArquivos(dados, pasta);

    expect(arquivos).toEqual({
      json: path.join(pasta, 'importacao-20261007-090503.json'),
      csv: path.join(pasta, 'importacao-20261007-090503-descartes.csv'),
    });
    expect((await readdir(pasta)).sort()).toEqual([
      'importacao-20261007-090503-descartes.csv',
      'importacao-20261007-090503.json',
    ]);

    const json: unknown = JSON.parse(await readFile(arquivos.json, 'utf-8'));
    expect(json).toMatchObject({
      origem: 'manual',
      situacao: 'concluida',
      totais: { lidas: 7359, importadas: 7153, corrigidas: 4612, descartadas: 206 },
      descartesPorMotivo: { passada_sem_resultado: 69, duplicada: 40, fora_da_grade: 18 },
      descartes: [{ linha: 2 }, { linha: 5 }],
    });
    expect(await readFile(arquivos.csv, 'utf-8')).toBe(montarCsvDescartes(dados.descartes));
  });

  it('usa o dia de São Paulo quando em UTC já é o dia seguinte', async () => {
    pastaTemporaria = await mkdtemp(path.join(os.tmpdir(), 'relatorio-'));

    // 01:30 UTC de 08/10 = 22:30 de 07/10 em São Paulo
    const arquivos = await salvarArquivos(
      importacao({ iniciadaEm: new Date('2026-10-08T01:30:00Z') }),
      pastaTemporaria,
    );

    expect(path.basename(arquivos.json)).toBe('importacao-20261007-223000.json');
  });
});

describe('resumoTerminal', () => {
  it('mostra a situação, os 4 totais e cada motivo com a contagem', () => {
    const resumo = resumoTerminal(importacao());

    expect(resumo).toContain('Importação concluída');
    expect(resumo).toContain('Lidas: 7359');
    expect(resumo).toContain('Importadas: 7153');
    expect(resumo).toContain('Corrigidas: 4612');
    expect(resumo).toContain('Descartadas: 206');
    expect(resumo).toContain('passada_sem_resultado: 69');
    expect(resumo).toContain('duplicada: 40');
    expect(resumo).toContain('fora_da_grade: 18');
  });

  it('numa importação que falhou mostra a situação e a mensagem do erro', () => {
    const resumo = resumoTerminal(
      importacao({ situacao: 'falhou', erro: 'Não foi possível ler o arquivo /data/medicos.json', totais: null }),
    );

    expect(resumo).toContain('Importação falhou');
    expect(resumo).toContain('Não foi possível ler o arquivo /data/medicos.json');
  });
});

import path from 'node:path';
import { mongo, type HydratedDocument } from 'mongoose';
import { Importacao, type DadosImportacao, type OrigemImportacao } from '../models/importacao';
import { gravarDados } from './gravar';
import { lerAgendamentos, lerMedicos } from './ler-arquivos';
import { processar } from './processar';
import { resumoTerminal, salvarArquivos } from './relatorio';

export class ImportacaoEmAndamentoError extends Error {
  constructor() {
    super('Já existe uma importação em andamento');
    this.name = 'ImportacaoEmAndamentoError';
  }
}

export type ImportacaoDoc = HydratedDocument<DadosImportacao>;

interface OpcoesImportacao {
  origem: OrigemImportacao;
  dataDir: string; // pasta com medicos.json e agendamentos.csv; os relatórios vão para <dataDir>/relatorios
}

// Registra a importação como em andamento. O índice único parcial do model recusa uma segunda.
async function registrarInicio(origem: OrigemImportacao): Promise<ImportacaoDoc> {
  await Importacao.init(); // garante que o índice da trava já existe
  try {
    return await Importacao.create({ origem, situacao: 'em_andamento', iniciadaEm: new Date() });
  } catch (err) {
    if (err instanceof mongo.MongoServerError && err.code === 11000) {
      throw new ImportacaoEmAndamentoError();
    }
    throw err;
  }
}

// Roda uma importação do começo ao fim. Não lança quando a importação falha:
// devolve o registro com situação "falhou" e a mensagem (os dados do banco ficam como estavam).
export async function executarImportacao({ origem, dataDir }: OpcoesImportacao): Promise<ImportacaoDoc> {
  const importacao = await registrarInicio(origem);

  try {
    const medicos = await lerMedicos(path.join(dataDir, 'medicos.json'));
    const linhas = await lerAgendamentos(path.join(dataDir, 'agendamentos.csv'));
    const resultado = processar(linhas, medicos);

    await gravarDados({ medicos: resultado.medicos, pacientes: resultado.pacientes, consultas: resultado.consultas });

    importacao.set({
      situacao: 'concluida',
      finalizadaEm: new Date(),
      dataReferencia: resultado.dataReferencia,
      totais: resultado.totais,
      descartesPorMotivo: resultado.descartesPorMotivo,
      correcoesPorTipo: resultado.correcoesPorTipo,
      descartes: resultado.descartes,
    });
  } catch (err) {
    importacao.set({
      situacao: 'falhou',
      finalizadaEm: new Date(),
      erro: err instanceof Error ? err.message : String(err),
    });
  }

  // Falhar ao escrever os arquivos não desfaz a importação: o relatório continua no banco.
  try {
    importacao.arquivos = await salvarArquivos(
      importacao.toObject({ minimize: false }),
      path.join(dataDir, 'relatorios'),
    );
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    console.warn(`Aviso: não foi possível gravar os arquivos do relatório (${detalhe})`);
  }

  await importacao.save();
  console.log(resumoTerminal(importacao.toObject({ minimize: false })));
  return importacao;
}

// Ao subir o backend: importações que ficaram "em andamento" são sobras de um processo que morreu.
export async function marcarInterrompidas(): Promise<void> {
  await Importacao.updateMany(
    { situacao: 'em_andamento' },
    { situacao: 'falhou', erro: 'Importação interrompida', finalizadaEm: new Date() },
  );
}

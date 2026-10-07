import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  COLUNAS_CSV,
  MOTIVOS_DESCARTE,
  type DadosImportacao,
  type Descarte,
  type SituacaoImportacao,
} from '../models/importacao';
import { OFFSET_SAO_PAULO } from './normalizar';

// Valor com vírgula, aspas ou quebra de linha vai entre aspas, com as aspas internas dobradas.
function celulaCsv(valor: string): string {
  if (/[",\r\n]/.test(valor)) {
    return `"${valor.replaceAll('"', '""')}"`;
  }
  return valor;
}

// CSV das linhas descartadas: número da linha, motivo e as 9 colunas como vieram.
export function montarCsvDescartes(descartes: Descarte[]): string {
  const cabecalho = ['linha', 'motivo', ...COLUNAS_CSV];
  const linhas = descartes.map((descarte) => [
    String(descarte.linha),
    descarte.motivo,
    ...COLUNAS_CSV.map((coluna) => descarte.valores[coluna]),
  ]);

  return [cabecalho, ...linhas].map((celulas) => celulas.map(celulaCsv).join(',') + '\n').join('');
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

// "AAAAMMDD-HHmmss" no horário de São Paulo (AD-002: deslocamento fixo, ex.: "-03:00").
function dataHoraNoNome(data: Date): string {
  const [horas, minutos] = OFFSET_SAO_PAULO.slice(1).split(':').map(Number);
  const sinal = OFFSET_SAO_PAULO.startsWith('-') ? -1 : 1;
  const local = new Date(data.getTime() + sinal * (horas * 60 + minutos) * 60_000);

  const dia = `${local.getUTCFullYear()}${doisDigitos(local.getUTCMonth() + 1)}${doisDigitos(local.getUTCDate())}`;
  const hora = `${doisDigitos(local.getUTCHours())}${doisDigitos(local.getUTCMinutes())}${doisDigitos(local.getUTCSeconds())}`;
  return `${dia}-${hora}`;
}

// Nome base dos arquivos de uma importação: "importacao-AAAAMMDD-HHmmss" (início, horário de São Paulo).
export function nomeDoRelatorio(iniciadaEm: Date): string {
  return `importacao-${dataHoraNoNome(iniciadaEm)}`;
}

// Grava o relatório completo (JSON) e as linhas descartadas (CSV) na pasta, criando-a se preciso.
export async function salvarArquivos(importacao: DadosImportacao, dir: string): Promise<{ json: string; csv: string }> {
  const base = nomeDoRelatorio(importacao.iniciadaEm);
  const arquivos = {
    json: path.join(dir, `${base}.json`),
    csv: path.join(dir, `${base}-descartes.csv`),
  };

  await mkdir(dir, { recursive: true });
  await writeFile(arquivos.json, JSON.stringify(importacao, null, 2) + '\n', 'utf-8');
  await writeFile(arquivos.csv, montarCsvDescartes(importacao.descartes), 'utf-8');
  return arquivos;
}

const SITUACAO_TEXTO: Record<SituacaoImportacao, string> = {
  em_andamento: 'em andamento',
  concluida: 'concluída',
  falhou: 'falhou',
};

// Resumo impresso no terminal ao fim da importação.
export function resumoTerminal(importacao: DadosImportacao): string {
  const linhas = [`Importação ${SITUACAO_TEXTO[importacao.situacao]}`];

  if (importacao.erro) {
    linhas.push(`  Erro: ${importacao.erro}`);
  }

  if (importacao.totais) {
    const { lidas, importadas, corrigidas, descartadas } = importacao.totais;
    linhas.push(
      `  Lidas: ${lidas}`,
      `  Importadas: ${importadas}`,
      `  Corrigidas: ${corrigidas}`,
      `  Descartadas: ${descartadas}`,
    );
  }

  const motivos = MOTIVOS_DESCARTE.filter((motivo) => importacao.descartesPorMotivo[motivo]);
  if (motivos.length > 0) {
    linhas.push('  Descartes por motivo:');
    for (const motivo of motivos) {
      linhas.push(`    ${motivo}: ${importacao.descartesPorMotivo[motivo]}`);
    }
  }

  return linhas.join('\n');
}

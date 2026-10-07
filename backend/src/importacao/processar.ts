import { COLUNAS_CSV, type Descarte, type MotivoDescarte } from '../models/importacao';
import type { LinhaCsv, MedicoArquivo } from './ler-arquivos';
import { lerDataHora, normalizarStatus } from './normalizar';

export type { LinhaCsv } from './ler-arquivos';

export interface ResultadoProcessamento {
  dataReferencia: Date | null; // maior data_agendamento legível (data da exportação)
  descartes: Descarte[]; // em ordem de linha
}

// Transforma as linhas do CSV no que deve ser gravado e no relatório.
// Função pura: não lê arquivo, não acessa banco e não usa o relógio.
export function processar(linhas: LinhaCsv[], medicos: MedicoArquivo[]): ResultadoProcessamento {
  void medicos; // usado nas regras por linha
  const descartes: Descarte[] = [];
  const descartar = (linha: LinhaCsv, motivo: MotivoDescarte) => descartes.push(montarDescarte(linha, motivo));

  // 1. Data de referência: o que é "passado" e "futuro" vem do arquivo, nunca do relógio.
  const dataReferencia = calcularDataReferencia(linhas);

  // 2. Linhas idênticas: fica a primeira.
  const unicas: LinhaCsv[] = [];
  const jaVistas = new Set<string>();
  for (const linha of linhas) {
    const chave = valoresDaLinha(linha).join('\u0000');
    if (jaVistas.has(chave)) {
      descartar(linha, 'duplicada');
    } else {
      jaVistas.add(chave);
      unicas.push(linha);
    }
  }

  // 3. Mesmo id com versões diferentes.
  const seguem = resolverConflitos(unicas, descartar);
  void seguem; // as regras por linha entram no próximo passo

  descartes.sort((a, b) => a.linha - b.linha);
  return { dataReferencia, descartes };
}

function calcularDataReferencia(linhas: LinhaCsv[]): Date | null {
  let maior: Date | null = null;
  for (const linha of linhas) {
    const data = lerDataHora(linha.data_agendamento);
    if (data && (!maior || data.instante > maior)) {
      maior = data.instante;
    }
  }
  return maior;
}

// Os 9 valores da linha, na ordem das colunas do CSV.
function valoresDaLinha(linha: LinhaCsv): string[] {
  return COLUNAS_CSV.map((coluna) => linha[coluna]);
}

function montarDescarte(linha: LinhaCsv, motivo: MotivoDescarte): Descarte {
  const { linha: numero, ...valores } = linha;
  return { linha: numero, codigo: linha.id, motivo, valores };
}

// Colunas que diferem entre as versões de um mesmo id.
function colunasDiferentes(versoes: LinhaCsv[]): string[] {
  return COLUNAS_CSV.filter((coluna) => new Set(versoes.map((v) => v[coluna])).size > 1);
}

function ehCancelamento(status: string): boolean {
  const normalizado = normalizarStatus(status);
  return normalizado?.status === 'cancelada_paciente' || normalizado?.status === 'cancelada_clinica';
}

// Médico + instante da consulta, para comparar horários escritos em formatos diferentes.
function chaveSlot(linha: LinhaCsv): string | null {
  const data = lerDataHora(linha.data_consulta);
  return data ? `${linha.medico_id}|${data.instante.toISOString()}` : null;
}

// Agrupa por id. Grupos com uma versão seguem; grupos com versões diferentes são resolvidos
// pelos casos da spec (conflito de status, de horário ou de outros dados).
function resolverConflitos(
  linhas: LinhaCsv[],
  descartar: (linha: LinhaCsv, motivo: MotivoDescarte) => void,
): LinhaCsv[] {
  const porId = new Map<string, LinhaCsv[]>();
  for (const linha of linhas) {
    porId.set(linha.id, [...(porId.get(linha.id) ?? []), linha]);
  }

  // Slots com consulta ativa (não cancelada), e de quais ids, para o caso do horário diferente.
  const idsPorSlotAtivo = new Map<string, Set<string>>();
  for (const linha of linhas) {
    const chave = chaveSlot(linha);
    if (chave && !ehCancelamento(linha.status)) {
      idsPorSlotAtivo.set(chave, (idsPorSlotAtivo.get(chave) ?? new Set()).add(linha.id));
    }
  }
  // Livre = nenhuma consulta ativa de outro id no mesmo médico e horário.
  const slotLivre = (versao: LinhaCsv): boolean => {
    const chave = chaveSlot(versao);
    const ids = chave ? (idsPorSlotAtivo.get(chave) ?? new Set<string>()) : new Set<string>();
    return [...ids].every((id) => id === versao.id);
  };

  const seguem: LinhaCsv[] = [];
  for (const linha of linhas) {
    // Sem id não há grupo: a linha segue e cai em campo_obrigatorio adiante.
    const versoes = linha.id.trim() === '' ? [linha] : (porId.get(linha.id) ?? [linha]);
    if (versoes.length === 1) {
      seguem.push(linha);
      continue;
    }

    const diferentes = colunasDiferentes(versoes).join(',');
    if (diferentes === 'status') {
      descartar(linha, 'conflito_status');
    } else if (diferentes === 'data_consulta') {
      const livres = versoes.filter(slotLivre);
      if (livres.length !== 1) {
        descartar(linha, 'conflito_horario');
      } else if (livres[0] === linha) {
        seguem.push(linha);
      } else {
        descartar(linha, 'conflito_horario_slot_ocupado');
      }
    } else {
      descartar(linha, 'conflito_dados');
    }
  }
  return seguem;
}

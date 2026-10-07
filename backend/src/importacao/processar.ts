import { estaNoSlot, type DadosConsulta } from '../models/consulta';
import { COLUNAS_CSV, type Descarte, type MotivoDescarte, type TipoCorrecao } from '../models/importacao';
import type { LinhaCsv, MedicoArquivo } from './ler-arquivos';
import { lerDataHora, normalizarStatus, normalizarTelefone, normalizarTipo } from './normalizar';

export type { LinhaCsv } from './ler-arquivos';

export interface ResultadoProcessamento {
  dataReferencia: Date | null; // maior data_agendamento legível (data da exportação)
  consultas: DadosConsulta[]; // na ordem do arquivo
  descartes: Descarte[]; // em ordem de linha
  correcoesPorTipo: Partial<Record<TipoCorrecao, number>>;
}

// Linha que passou por todas as regras: vira consulta, com as correções aplicadas a ela.
interface LinhaAprovada {
  linha: LinhaCsv;
  consulta: DadosConsulta;
  correcoes: TipoCorrecao[];
}

// Transforma as linhas do CSV no que deve ser gravado e no relatório.
// Função pura: não lê arquivo, não acessa banco e não usa o relógio.
export function processar(linhas: LinhaCsv[], medicos: MedicoArquivo[]): ResultadoProcessamento {
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

  // 4 e 5. Regras por linha: a primeira que falhar define o motivo; as outras viram consultas.
  const medicosPorId = new Map(medicos.map((medico) => [medico.id, medico]));
  const aprovadas: LinhaAprovada[] = [];
  for (const linha of seguem) {
    const avaliacao = avaliarLinha(linha, medicosPorId, dataReferencia);
    if ('motivo' in avaliacao) {
      descartar(linha, avaliacao.motivo);
    } else {
      aprovadas.push({ linha, ...avaliacao });
    }
  }

  const correcoesPorTipo: Partial<Record<TipoCorrecao, number>> = {};
  for (const { correcoes } of aprovadas) {
    for (const tipo of correcoes) {
      correcoesPorTipo[tipo] = (correcoesPorTipo[tipo] ?? 0) + 1;
    }
  }

  descartes.sort((a, b) => a.linha - b.linha);
  return {
    dataReferencia,
    consultas: aprovadas.map((aprovada) => aprovada.consulta),
    descartes,
    correcoesPorTipo,
  };
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

const CAMPOS_OBRIGATORIOS = [
  'id',
  'paciente_id',
  'paciente_nome',
  'medico_id',
  'data_agendamento',
  'data_consulta',
] as const;

const DURACAO_SLOT_MINUTOS = 30;

// "07:00" -> 420
function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Aplica as regras na ordem dos motivos. Devolve o motivo do descarte ou a consulta com as correções.
function avaliarLinha(
  linha: LinhaCsv,
  medicosPorId: Map<string, MedicoArquivo>,
  dataReferencia: Date | null,
): { motivo: MotivoDescarte } | Omit<LinhaAprovada, 'linha'> {
  if (CAMPOS_OBRIGATORIOS.some((coluna) => linha[coluna].trim() === '')) {
    return { motivo: 'campo_obrigatorio' };
  }

  const marcacao = lerDataHora(linha.data_agendamento);
  const consulta = lerDataHora(linha.data_consulta);
  // Se há uma data de marcação legível, a data de referência existe.
  if (!marcacao || !consulta || !dataReferencia) {
    return { motivo: 'data_invalida' };
  }

  const medico = medicosPorId.get(linha.medico_id);
  if (!medico) {
    return { motivo: 'medico_desconhecido' };
  }

  const tipo = normalizarTipo(linha.tipo_atendimento);
  if (!tipo) {
    return { motivo: 'tipo_desconhecido' };
  }

  const status = normalizarStatus(linha.status);
  if (!status) {
    return { motivo: 'status_desconhecido' };
  }

  // "Passado" inclui a própria data de referência.
  const passada = consulta.instante <= dataReferencia;
  if (status.status === '' && passada) {
    return { motivo: 'status_vazio_passado' };
  }

  if (!estaNoSlot(consulta.instante)) {
    return { motivo: 'fora_do_slot' };
  }

  // Dentro da grade: no dia certo, começando no início ou depois, e terminando até o fim.
  const inicioConsulta = consulta.hora * 60 + consulta.minuto;
  const dentroDaGrade = medico.grade.some(
    (horario) =>
      horario.dia === consulta.diaSemana &&
      inicioConsulta >= minutosDoDia(horario.inicio) &&
      inicioConsulta + DURACAO_SLOT_MINUTOS <= minutosDoDia(horario.fim),
  );
  if (!dentroDaGrade) {
    return { motivo: 'fora_da_grade' };
  }

  if (!passada && (status.status === 'realizada' || status.status === 'falta')) {
    return { motivo: 'resultado_no_futuro' };
  }
  if (passada && (status.status === 'agendada' || status.status === 'confirmada')) {
    return { motivo: 'passada_sem_resultado' };
  }

  // A linha entra: junta as correções feitas nela.
  const correcoes: TipoCorrecao[] = [];
  if (status.correcao) {
    correcoes.push(status.correcao);
  }
  if (status.status === '') {
    correcoes.push('status_vazio_futuro');
  }
  if (tipo.corrigido) {
    correcoes.push('tipo_padronizado');
  }
  if (marcacao.formatoBr || consulta.formatoBr) {
    correcoes.push('data_formato');
  }
  // Marcação depois da consulta: a data de marcação é desconhecida.
  const marcacaoInvalida = marcacao.instante > consulta.instante;
  if (marcacaoInvalida) {
    correcoes.push('data_agendamento_invalida');
  }
  if (normalizarTelefone(linha.paciente_telefone).invalido) {
    correcoes.push('telefone_invalido');
  }

  return {
    consulta: {
      codigoLegado: linha.id,
      pacienteId: linha.paciente_id,
      medicoId: linha.medico_id,
      tipoAtendimento: tipo.tipo,
      inicio: consulta.instante,
      marcadaEm: marcacaoInvalida ? null : marcacao.instante,
      canceladaEm: null, // o CSV não tem a data do cancelamento
      status: status.status === '' ? 'agendada' : status.status,
    },
    correcoes,
  };
}

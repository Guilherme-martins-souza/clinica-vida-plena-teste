import type { StatusConsulta, TipoAtendimento } from '../models/consulta';
import { OFFSET_SAO_PAULO } from '../fuso';
import { DIAS_SEMANA, type DiaSemana } from '../models/medico';

// Datas do CSV não trazem fuso: são horário de São Paulo (AD-002, deslocamento em src/fuso.ts).

export interface DataHoraLocal {
  ano: number;
  mes: number; // 1 a 12
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: DiaSemana;
  instante: Date;
  formatoBr: boolean; // true quando veio como DD/MM/AAAA
}

const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const FORMATO_BR = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

// Aceita "AAAA-MM-DD HH:mm" e "DD/MM/AAAA HH:mm" (com barra é sempre dia/mês).
// Devolve null se o texto não está num desses formatos ou a data não existe (ex.: 31/02).
export function lerDataHora(texto: string): DataHoraLocal | null {
  const limpo = texto.trim();
  let ano: number, mes: number, dia: number, hora: number, minuto: number;
  let formatoBr: boolean;

  const iso = FORMATO_ISO.exec(limpo);
  const br = FORMATO_BR.exec(limpo);
  if (iso) {
    [ano, mes, dia, hora, minuto] = iso.slice(1).map(Number);
    formatoBr = false;
  } else if (br) {
    [dia, mes, ano, hora, minuto] = br.slice(1).map(Number);
    formatoBr = true;
  } else {
    return null;
  }

  if (hora > 23 || minuto > 59) {
    return null;
  }

  // Se o dia não existe no mês, o Date "pula" para o mês seguinte e a data muda.
  const somenteData = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    somenteData.getUTCFullYear() !== ano ||
    somenteData.getUTCMonth() !== mes - 1 ||
    somenteData.getUTCDate() !== dia
  ) {
    return null;
  }

  const textoIso = `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}T${doisDigitos(hora)}:${doisDigitos(minuto)}:00${OFFSET_SAO_PAULO}`;

  return {
    ano,
    mes,
    dia,
    hora,
    minuto,
    diaSemana: DIAS_SEMANA[somenteData.getUTCDay()],
    instante: new Date(textoIso),
    formatoBr,
  };
}

// Sinônimos aceitos (em minúsculas, sem espaços nas pontas) e o status oficial de cada um.
const SINONIMOS_STATUS: Record<string, StatusConsulta> = {
  realizada: 'realizada',
  atendido: 'realizada',
  falta: 'falta',
  faltou: 'falta',
  no_show: 'falta',
  ausente: 'falta',
  agendada: 'agendada',
  confirmada: 'confirmada',
  confirmado: 'confirmada',
  cancelada_paciente: 'cancelada_paciente',
  'cancelado pelo paciente': 'cancelada_paciente',
  desmarcou: 'cancelada_paciente',
  cancelada_clinica: 'cancelada_clinica',
  'cancelado clinica': 'cancelada_clinica',
  cancelado: 'cancelada_clinica',
};

export interface StatusNormalizado {
  status: StatusConsulta | ''; // '' = status vazio no arquivo
  correcao?: 'status_padronizado' | 'cancelado_sem_autor';
}

// Devolve null quando o status não está na tabela.
export function normalizarStatus(texto: string): StatusNormalizado | null {
  const chave = texto.trim().toLowerCase();
  if (chave === '') {
    return { status: '' };
  }

  const status = SINONIMOS_STATUS[chave];
  if (!status) {
    return null;
  }
  // "cancelado" não diz quem cancelou: vira cancelamento da clínica, para não cobrar o paciente por engano.
  if (chave === 'cancelado') {
    return { status, correcao: 'cancelado_sem_autor' };
  }
  if (texto !== status) {
    return { status, correcao: 'status_padronizado' };
  }
  return { status };
}

// Tira acentos: "Convênio" -> "Convenio".
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Devolve null quando o tipo não é convênio nem particular.
export function normalizarTipo(texto: string): { tipo: TipoAtendimento; corrigido: boolean } | null {
  const chave = semAcento(texto.trim().toLowerCase());
  if (chave !== 'convenio' && chave !== 'particular') {
    return null;
  }
  return { tipo: chave, corrigido: texto !== chave };
}

// Telefone só com dígitos: DDD + número (10 ou 11 dígitos), sem o +55.
// Vazio continua vazio; o que não chega a um telefone válido fica vazio e marcado como inválido.
export function normalizarTelefone(texto: string): { telefone: string | null; invalido: boolean } {
  if (texto.trim() === '') {
    return { telefone: null, invalido: false };
  }

  let digitos = texto.replace(/\D/g, '');
  // Com o código do país (55) na frente, o número tem 12 ou 13 dígitos.
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    digitos = digitos.slice(2);
  }

  if (digitos.length === 10 || digitos.length === 11) {
    return { telefone: digitos, invalido: false };
  }
  return { telefone: null, invalido: true };
}

// Remove espaços das pontas e espaços repetidos no meio.
export function limparNome(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

function todaMaiuscula(nome: string): boolean {
  return nome === nome.toUpperCase() && nome !== nome.toLowerCase();
}

// Escolhe a grafia do nome do paciente: a mais frequente; no empate, a que não está toda em
// maiúsculas; depois, a que aparece primeiro no arquivo (menor número de linha).
export function escolherNome(grafias: { nome: string; linha: number }[]): string {
  const porNome = new Map<string, { vezes: number; primeiraLinha: number }>();
  for (const { nome, linha } of grafias) {
    const atual = porNome.get(nome);
    if (atual) {
      atual.vezes += 1;
      atual.primeiraLinha = Math.min(atual.primeiraLinha, linha);
    } else {
      porNome.set(nome, { vezes: 1, primeiraLinha: linha });
    }
  }

  const candidatos = [...porNome.entries()].map(([nome, dados]) => ({ nome, ...dados }));
  candidatos.sort((a, b) => {
    if (a.vezes !== b.vezes) {
      return b.vezes - a.vezes;
    }
    if (todaMaiuscula(a.nome) !== todaMaiuscula(b.nome)) {
      return todaMaiuscula(a.nome) ? 1 : -1;
    }
    return a.primeiraLinha - b.primeiraLinha;
  });

  return candidatos[0]?.nome ?? '';
}

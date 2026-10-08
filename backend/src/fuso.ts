import { DIAS_SEMANA, type DiaSemana } from './models/medico';

// Datas sem fuso (CSV, formulários) são horário de São Paulo (AD-002).
// O Brasil não tem horário de verão desde 2019, então o deslocamento é sempre -03:00.
// Se o horário de verão voltar, esta constante precisa virar um cálculo por data.
export const OFFSET_SAO_PAULO = '-03:00';

// O mesmo deslocamento em minutos (-180), para fazer contas com instantes.
const [horasOffset, minutosOffset] = OFFSET_SAO_PAULO.slice(1).split(':').map(Number);
const OFFSET_MINUTOS = (OFFSET_SAO_PAULO.startsWith('-') ? -1 : 1) * (horasOffset * 60 + minutosOffset);

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface PartesEmSaoPaulo {
  data: string; // AAAA-MM-DD
  diaSemana: DiaSemana;
  minutosDoDia: number; // 08:30 → 510
}

// Data, dia da semana e hora (em minutos) de um instante no calendário de São Paulo.
export function partesEmSaoPaulo(instante: Date): PartesEmSaoPaulo {
  // Somando o deslocamento, os campos UTC do Date passam a ser os de São Paulo.
  const local = new Date(instante.getTime() + OFFSET_MINUTOS * 60_000);
  return {
    data: local.toISOString().slice(0, 10),
    diaSemana: DIAS_SEMANA[local.getUTCDay()],
    minutosDoDia: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

// 00:00 de São Paulo do dia informado, como instante.
export function inicioDoDia(data: string): Date {
  return new Date(`${data}T00:00:00${OFFSET_SAO_PAULO}`);
}

// "2026-12-31" → "2027-01-01".
export function diaSeguinte(data: string): string {
  const dia = new Date(`${data}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia.toISOString().slice(0, 10);
}

// true quando o texto é AAAA-MM-DD e o dia existe (2026-02-30 não existe).
export function ehDataIso(texto: string): boolean {
  if (!FORMATO_DATA.test(texto)) {
    return false;
  }
  // Se o dia não existe, o Date "pula" para o mês seguinte e a data muda.
  const dia = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === texto;
}

import type { StatusConsulta } from '../models/consulta';

// Status e transições permitidas, como na tabela do enunciado (AGD-02).
// Status finais não vão para nenhum outro.
export const TRANSICOES: Record<StatusConsulta, StatusConsulta[]> = {
  agendada: ['confirmada', 'realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'],
  confirmada: ['realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica'],
  realizada: [],
  falta: [],
  cancelada_paciente: [],
  cancelada_clinica: [],
};

export function ehFinal(status: StatusConsulta): boolean {
  return TRANSICOES[status].length === 0;
}

export interface ErroDeTransicao {
  code: 'TRANSICAO_INVALIDA' | 'ANTES_DO_HORARIO' | 'DEPOIS_DO_HORARIO';
  message: string;
}

// Devolve null quando a mudança vale, ou o erro que a API deve responder.
// Realizada e falta valem a partir do início (agora >= início);
// confirmação e cancelamento só antes dele (agora < início).
export function validarTransicao(
  atual: StatusConsulta,
  novo: StatusConsulta,
  inicio: Date,
  agora: Date,
): ErroDeTransicao | null {
  if (ehFinal(atual)) {
    return { code: 'TRANSICAO_INVALIDA', message: `Consulta com status final (${atual}) não muda mais.` };
  }
  if (!TRANSICOES[atual].includes(novo)) {
    return { code: 'TRANSICAO_INVALIDA', message: `Não é possível mudar de ${atual} para ${novo}.` };
  }

  const comecou = agora.getTime() >= inicio.getTime();
  if ((novo === 'realizada' || novo === 'falta') && !comecou) {
    return {
      code: 'ANTES_DO_HORARIO',
      message: `A consulta só pode ser marcada como ${novo} a partir do horário dela.`,
    };
  }
  if (novo !== 'realizada' && novo !== 'falta' && comecou) {
    return { code: 'DEPOIS_DO_HORARIO', message: `A consulta só pode ser marcada como ${novo} antes do horário dela.` };
  }
  return null;
}

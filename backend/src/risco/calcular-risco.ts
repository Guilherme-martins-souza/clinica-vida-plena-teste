import { partesEmSaoPaulo } from '../fuso';
import type { StatusConsulta, TipoAtendimento } from '../models/consulta';
import { CORTES, FALTAS_ALTO_RISCO, HORAS_SEM_CONFIRMACAO, PESOS, TAXA_FALTAS_ALTA, type CodigoFator } from './pesos';

export type NivelRisco = 'baixo' | 'media' | 'alta' | 'muito_alta';

export interface EntradaRisco {
  inicio: Date;
  agora: Date;
  status: StatusConsulta;
  tipoAtendimento: TipoAtendimento;
  primeiraConsulta: boolean;
  // Histórico completo do paciente antes desta consulta.
  faltas: number;
  atendimentos: number;
}

export interface FatorRisco {
  codigo: CodigoFator;
  pontos: number;
}

export interface ResultadoRisco {
  pontos: number;
  nivel: NivelRisco;
  fatores: FatorRisco[];
}

const MEIO_DIA_MINUTOS = 12 * 60;
const HORA_MS = 60 * 60 * 1000;

export function classificar(pontos: number): NivelRisco {
  if (pontos >= CORTES.muitoAlta) {
    return 'muito_alta';
  }
  if (pontos >= CORTES.alta) {
    return 'alta';
  }
  if (pontos >= CORTES.media) {
    return 'media';
  }
  return 'baixo';
}

// Soma os pesos dos fatores que valem para a consulta e classifica o total.
export function calcularRisco(entrada: EntradaRisco): ResultadoRisco {
  const fatores: FatorRisco[] = [];
  const somar = (codigo: CodigoFator) => fatores.push({ codigo, pontos: PESOS[codigo] });

  // Sem atendimento não há taxa (evita dividir por zero).
  const taxa = entrada.atendimentos > 0 ? entrada.faltas / entrada.atendimentos : 0;
  if (entrada.faltas >= FALTAS_ALTO_RISCO || taxa > TAXA_FALTAS_ALTA) {
    somar('historico');
  }
  if (entrada.primeiraConsulta) {
    somar('primeiraConsulta');
  }
  if (entrada.tipoAtendimento === 'convenio') {
    somar('convenio');
  }
  const { diaSemana, minutosDoDia } = partesEmSaoPaulo(entrada.inicio);
  if (diaSemana === 'segunda' && minutosDoDia < MEIO_DIA_MINUTOS) {
    somar('segundaDeManha');
  }
  const faltam = entrada.inicio.getTime() - entrada.agora.getTime();
  if (entrada.status === 'agendada' && faltam < HORAS_SEM_CONFIRMACAO * HORA_MS) {
    somar('semConfirmacao');
  }

  const pontos = fatores.reduce((soma, fator) => soma + fator.pontos, 0);
  return { pontos, nivel: classificar(pontos), fatores };
}

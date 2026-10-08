import { partesEmSaoPaulo } from '../fuso';
import { TIPOS_ATENDIMENTO, type StatusConsulta, type TipoAtendimento } from '../models/consulta';
import type { DadosMedico, DiaSemana } from '../models/medico';

// Os números da tela de Indicadores (IND-01), calculados em memória a partir das consultas do período.
// Função pura: a rota busca os dados no banco e passa para cá.

export interface ConsultaParaIndicador {
  id: string;
  medicoId: string;
  tipoAtendimento: TipoAtendimento;
  inicio: Date;
  marcadaEm: Date | null;
  canceladaEm: Date | null;
  status: StatusConsulta;
}

/** Faltas e consultas concluídas (realizadas + faltas) de um recorte. A taxa é calculada na tela. */
export interface ContagemFaltas {
  faltas: number;
  concluidas: number;
}

export interface EntradaIndicadores {
  periodo: { de: string; ate: string }; // AAAA-MM-DD
  consultas: ConsultaParaIndicador[]; // início dentro do período
  anteriores: ConsultaParaIndicador[]; // início dentro do período anterior, de mesmo tamanho
  medicos: DadosMedico[];
  primeiras: Set<string>; // ids das consultas que são a primeira do paciente
  proximas: { total: number; semConfirmacao: number };
}

export interface Indicadores {
  periodo: { de: string; ate: string };
  totais: {
    realizadas: number;
    faltas: number;
    canceladasPaciente: number;
    canceladasClinica: number;
    proximas: number;
    proximasSemConfirmacao: number;
  };
  /** Taxa de falta (%) do período anterior; null quando ele não tem consulta concluída. */
  taxaFaltaPeriodoAnterior: number | null;
  porMedico: (ContagemFaltas & { medico: { id: string; nome: string; especialidade: string } })[];
  /** Segunda a sexta, nessa ordem. */
  diaTurno: { turno: 'Manhã' | 'Tarde'; dias: ContagemFaltas[] }[];
  porTipo: (ContagemFaltas & { tipo: TipoAtendimento })[];
  porPrimeiraConsulta: (ContagemFaltas & { primeiraConsulta: boolean })[];
  porAntecedencia: (ContagemFaltas & { faixa: string })[];
}

export type Resultado = 'realizada' | 'falta' | 'cancelada_paciente' | 'cancelada_clinica';

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const MEIO_DIA_MINUTOS = 12 * 60;
const DIAS_UTEIS: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

// Faixas de antecedência: dias inteiros entre a marcação e a consulta.
const FAIXAS = [
  { faixa: 'Até 7 dias', ate: 7 },
  { faixa: '8 a 14 dias', ate: 14 },
  { faixa: '15 a 21 dias', ate: 21 },
  { faixa: '22 dias ou mais', ate: Infinity },
];

/**
 * O que a consulta conta nos indicadores. Cancelamento do paciente a menos de 24 h do início conta
 * como falta (D23). Agendada e confirmada ainda não têm resultado (null).
 */
export function resultado(
  consulta: Pick<ConsultaParaIndicador, 'status' | 'inicio' | 'canceladaEm'>,
): Resultado | null {
  const { status, inicio, canceladaEm } = consulta;
  if (status === 'agendada' || status === 'confirmada') {
    return null;
  }
  if (status === 'cancelada_paciente' && canceladaEm && inicio.getTime() - canceladaEm.getTime() < UM_DIA_MS) {
    return 'falta';
  }
  return status;
}

function zerada(): ContagemFaltas {
  return { faltas: 0, concluidas: 0 };
}

// Soma uma consulta concluída na contagem.
function somar(contagem: ContagemFaltas, ehFalta: boolean): void {
  contagem.concluidas += 1;
  if (ehFalta) {
    contagem.faltas += 1;
  }
}

function taxaDoPeriodo(consultas: ConsultaParaIndicador[]): number | null {
  const total = zerada();
  for (const consulta of consultas) {
    const r = resultado(consulta);
    if (r === 'realizada' || r === 'falta') {
      somar(total, r === 'falta');
    }
  }
  return total.concluidas === 0 ? null : (total.faltas / total.concluidas) * 100;
}

export function calcularIndicadores(entrada: EntradaIndicadores): Indicadores {
  const totais = {
    realizadas: 0,
    faltas: 0,
    canceladasPaciente: 0,
    canceladasClinica: 0,
    proximas: entrada.proximas.total,
    proximasSemConfirmacao: entrada.proximas.semConfirmacao,
  };

  // Uma contagem por recorte; cada consulta concluída soma nas que se aplicam a ela.
  const porMedico = new Map(entrada.medicos.map((medico) => [medico._id, zerada()]));
  const manha = DIAS_UTEIS.map(zerada);
  const tarde = DIAS_UTEIS.map(zerada);
  const porTipo = new Map(TIPOS_ATENDIMENTO.map((tipo) => [tipo, zerada()]));
  const primeira = zerada();
  const retorno = zerada();
  const porFaixa = FAIXAS.map(zerada);

  for (const consulta of entrada.consultas) {
    const r = resultado(consulta);
    if (r === 'cancelada_paciente') {
      totais.canceladasPaciente += 1;
    } else if (r === 'cancelada_clinica') {
      totais.canceladasClinica += 1;
    }
    if (r !== 'realizada' && r !== 'falta') {
      continue;
    }

    const ehFalta = r === 'falta';
    if (ehFalta) {
      totais.faltas += 1;
    } else {
      totais.realizadas += 1;
    }

    const contagemMedico = porMedico.get(consulta.medicoId);
    if (contagemMedico) {
      somar(contagemMedico, ehFalta);
    }

    const { diaSemana, minutosDoDia } = partesEmSaoPaulo(consulta.inicio);
    const dia = DIAS_UTEIS.indexOf(diaSemana);
    if (dia >= 0) {
      somar(minutosDoDia < MEIO_DIA_MINUTOS ? manha[dia] : tarde[dia], ehFalta);
    }

    const contagemTipo = porTipo.get(consulta.tipoAtendimento);
    if (contagemTipo) {
      somar(contagemTipo, ehFalta);
    }

    somar(entrada.primeiras.has(consulta.id) ? primeira : retorno, ehFalta);

    // Sem data de marcação (parte do histórico), a consulta fica fora deste recorte.
    if (consulta.marcadaEm) {
      const dias = Math.floor((consulta.inicio.getTime() - consulta.marcadaEm.getTime()) / UM_DIA_MS);
      const faixa = FAIXAS.findIndex((item) => dias <= item.ate);
      somar(porFaixa[faixa], ehFalta);
    }
  }

  return {
    periodo: entrada.periodo,
    totais,
    taxaFaltaPeriodoAnterior: taxaDoPeriodo(entrada.anteriores),
    porMedico: entrada.medicos.map((medico) => ({
      medico: { id: medico._id, nome: medico.nome, especialidade: medico.especialidade },
      ...(porMedico.get(medico._id) ?? zerada()),
    })),
    diaTurno: [
      { turno: 'Manhã', dias: manha },
      { turno: 'Tarde', dias: tarde },
    ],
    porTipo: TIPOS_ATENDIMENTO.map((tipo) => ({ tipo, ...(porTipo.get(tipo) ?? zerada()) })),
    porPrimeiraConsulta: [
      { primeiraConsulta: true, ...primeira },
      { primeiraConsulta: false, ...retorno },
    ],
    porAntecedencia: FAIXAS.map((item, indice) => ({ faixa: item.faixa, ...porFaixa[indice] })),
  };
}

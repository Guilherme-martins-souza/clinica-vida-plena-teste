// Formato dos dados que a tela espera receber da API.
// Por enquanto vêm de mocks (src/api/mocks); quando o backend existir, só a busca muda.

export type AgendamentoStatus =
  'agendada' | 'confirmada' | 'realizada' | 'falta' | 'cancelada_paciente' | 'cancelada_clinica'

export type TipoAtendimento = 'convenio' | 'particular'

export type Medico = {
  id: string
  nome: string
  especialidade: string
}

/** Faltas e consultas concluídas (realizadas + faltas) de um recorte. A taxa é calculada na tela. */
export type ContagemFaltas = {
  faltas: number
  concluidas: number
}

export type Periodo = { de: Date; ate: Date }

export type Indicadores = {
  periodo: Periodo
  totais: {
    realizadas: number
    faltas: number
    canceladasPaciente: number
    canceladasClinica: number
    proximas: number
    proximasSemConfirmacao: number
  }
  /** Taxa de falta do período anterior, de mesmo tamanho, para a variação. */
  taxaFaltaPeriodoAnterior: number
  porMedico: (ContagemFaltas & { medico: Medico })[]
  /** Taxa de falta (%) por turno × dia da semana (seg a sex). */
  diaTurno: { turno: 'Manhã' | 'Tarde'; taxas: number[] }[]
  porTipo: (ContagemFaltas & { tipo: TipoAtendimento })[]
  porPrimeiraConsulta: (ContagemFaltas & { primeiraConsulta: boolean })[]
  porAntecedencia: (ContagemFaltas & { faixa: string })[]
}

export type Agendamento = {
  id: number
  paciente: { nome: string; telefone: string }
  tipo: TipoAtendimento
  medico: Medico
  marcadaEm: Date
  consultaEm: Date
  status: AgendamentoStatus
}

export type Pagina<T> = {
  itens: T[]
  total: number
  pagina: number
  porPagina: number
}

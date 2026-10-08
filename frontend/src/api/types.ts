// Formato dos dados que as telas recebem da API.
// A tabela de agendamentos ainda usa o mock de src/api/mocks até a tela de Agendamentos usar a API.

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

export type Turno = 'Manhã' | 'Tarde'

/** Resposta de GET /api/indicadores. */
export type Indicadores = {
  /** Dias pedidos, em AAAA-MM-DD. */
  periodo: { de: string; ate: string }
  totais: {
    realizadas: number
    faltas: number
    canceladasPaciente: number
    canceladasClinica: number
    proximas: number
    proximasSemConfirmacao: number
  }
  /** Taxa de falta (%) do período anterior, de mesmo tamanho; null quando ele não tem consulta concluída. */
  taxaFaltaPeriodoAnterior: number | null
  porMedico: (ContagemFaltas & { medico: Medico })[]
  /** Contagens por turno × dia da semana (seg a sex, nessa ordem). */
  diaTurno: { turno: Turno; dias: ContagemFaltas[] }[]
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

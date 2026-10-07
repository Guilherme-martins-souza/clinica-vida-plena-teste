import { agendamentosMock } from './mocks/agendamentos.mock'
import { indicadoresMock } from './mocks/indicadores.mock'
import { isToday } from '../lib/format'
import type { Agendamento, AgendamentoStatus, Indicadores, Pagina, Periodo } from './types'

// Funções de busca usadas pela tela de Indicadores.
// Hoje devolvem mocks com um pequeno atraso, para a tela já tratar o "carregando".
// Quando o backend existir, troque o corpo por um fetch('/api/...') mantendo a mesma assinatura.

const MOCK_DELAY_MS = 300

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS))
}

export function fetchIndicadores(periodo: Periodo): Promise<Indicadores> {
  return delay(indicadoresMock(periodo))
}

/** "hoje" lista só as consultas do dia; "todos", as do período inteiro. */
export type AgendamentosQuando = 'hoje' | 'todos'

export type AgendamentosFiltro = {
  periodo: Periodo
  quando: AgendamentosQuando
  busca: string
  status: AgendamentoStatus | null
  medicoId: string | null
  pagina: number
  porPagina: number
}

export function fetchAgendamentos(filtro: AgendamentosFiltro): Promise<Pagina<Agendamento>> {
  // Simula o que o servidor fará: filtrar, ordenar (consulta mais recente primeiro) e paginar.
  const busca = filtro.busca.trim().toLocaleLowerCase('pt-BR')
  const filtrados = agendamentosMock
    .filter((a) => filtro.quando === 'todos' || isToday(a.consultaEm))
    .filter((a) => !busca || a.paciente.nome.toLocaleLowerCase('pt-BR').includes(busca))
    .filter((a) => !filtro.status || a.status === filtro.status)
    .filter((a) => !filtro.medicoId || a.medico.id === filtro.medicoId)
    .sort((a, b) => b.consultaEm.getTime() - a.consultaEm.getTime())

  const inicio = (filtro.pagina - 1) * filtro.porPagina
  return delay({
    itens: filtrados.slice(inicio, inicio + filtro.porPagina),
    total: filtrados.length,
    pagina: filtro.pagina,
    porPagina: filtro.porPagina,
  })
}

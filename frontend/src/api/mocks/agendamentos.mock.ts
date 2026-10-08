import type { Agendamento, AgendamentoStatus, Medico, TipoAtendimento } from '../types'

// Lista de agendamentos de mentira, gerada de forma fixa (sempre a mesma) para a tabela.
// Sai quando a tela de Agendamentos passar a usar a API de consultas.

export const medicosMock: Medico[] = [
  { id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia' },
  { id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia' },
  { id: 'MED03', nome: 'Dr. Carlos Souza', especialidade: 'Ortopedia' },
  { id: 'MED04', nome: 'Dra. Fernanda Lima', especialidade: 'Pediatria' },
  { id: 'MED05', nome: 'Dr. Roberto Alves', especialidade: 'Clínica Geral' },
  { id: 'MED06', nome: 'Dra. Beatriz Costa', especialidade: 'Ginecologia' },
]

const pacientes = [
  { nome: 'Patrícia Correia Brandão', telefone: '(54) 91234-1342' },
  { nome: 'Pedro Brandão Batista', telefone: '(53) 96470-3160' },
  { nome: 'Felipe Coelho Almeida', telefone: '(53) 94895-4499' },
  { nome: 'Marlene Couto', telefone: '(11) 99630-4418' },
  { nome: 'Rafael Teixeira', telefone: '(11) 98107-2253' },
  { nome: 'Beatriz Yamamoto', telefone: '(11) 99418-7702' },
  { nome: 'Antônio Carlos Reis', telefone: '(11) 97754-9081' },
  { nome: 'Luciana Barreto', telefone: '(11) 98321-5540' },
  { nome: 'Sérgio Monteiro', telefone: '(11) 99905-3316' },
  { nome: 'Fernanda Albuquerque', telefone: '(11) 98842-1107' },
  { nome: 'João Pedro Santana', telefone: '(11) 97215-6630' },
]

const statusCycle: AgendamentoStatus[] = [
  'confirmada',
  'agendada',
  'falta',
  'realizada',
  'cancelada_paciente',
  'falta',
  'realizada',
  'cancelada_clinica',
  'realizada',
  'realizada',
]

const horarios = ['08:00', '08:30', '09:00', '10:30', '11:00', '14:00', '15:30', '16:30']

/** Dias a partir de hoje: os 9 primeiros são hoje, os 6 seguintes nos próximos dias e o resto no passado. */
function diasAPartirDeHoje(i: number): number {
  if (i < 9) return 0
  if (i < 15) return i - 8
  return -Math.floor((i - 15) / 2) - 1
}

function buildAgendamentos(): Agendamento[] {
  const total = 42
  const lista: Agendamento[] = []
  const DIA = 24 * 60 * 60 * 1000
  // Meia-noite de hoje no horário de Brasília (UTC−3), para o filtro "Hoje" sempre ter dados.
  const hojeBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const meiaNoiteHoje = new Date(`${hojeBrasilia}T00:00:00-03:00`).getTime()

  for (let i = 0; i < total; i++) {
    const [hora, minuto] = horarios[i % horarios.length].split(':')
    const consultaEm = new Date(meiaNoiteHoje + diasAPartirDeHoje(i) * DIA)
    consultaEm.setUTCHours(Number(hora) + 3, Number(minuto)) // horário de Brasília = UTC−3
    const marcadaEm = new Date(consultaEm.getTime() - (7 + ((i * 5) % 23)) * DIA)
    const tipo: TipoAtendimento = i % 3 === 1 ? 'particular' : 'convenio'
    const futura = consultaEm.getTime() > Date.now()

    lista.push({
      id: 10482 - i * 3,
      paciente: pacientes[i % pacientes.length],
      tipo,
      medico: medicosMock[i % medicosMock.length],
      marcadaEm,
      consultaEm,
      // Consulta futura só pode estar agendada ou confirmada.
      status: futura ? (i % 2 === 0 ? 'confirmada' : 'agendada') : statusCycle[i % statusCycle.length],
    })
  }
  return lista
}

export const agendamentosMock = buildAgendamentos()

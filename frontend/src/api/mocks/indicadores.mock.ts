import type { Indicadores, Medico, Periodo } from '../types'

// Dados de mentira para montar a tela. Os números fecham entre si:
// 331 faltas em 1.180 consultas concluídas = 28,1%.

export const medicosMock: Medico[] = [
  { id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia' },
  { id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia' },
  { id: 'MED03', nome: 'Dr. Carlos Souza', especialidade: 'Ortopedia' },
  { id: 'MED04', nome: 'Dra. Fernanda Lima', especialidade: 'Pediatria' },
  { id: 'MED05', nome: 'Dr. Roberto Alves', especialidade: 'Clínica Geral' },
  { id: 'MED06', nome: 'Dra. Beatriz Costa', especialidade: 'Ginecologia' },
]

const [paulo, ana, carlos, fernanda, roberto, beatriz] = medicosMock

export function indicadoresMock(periodo: Periodo): Indicadores {
  return {
    periodo,
    totais: {
      realizadas: 849,
      faltas: 331,
      canceladasPaciente: 102,
      canceladasClinica: 46,
      proximas: 152,
      proximasSemConfirmacao: 61,
    },
    taxaFaltaPeriodoAnterior: 29.65,
    porMedico: [
      { medico: paulo, faltas: 74, concluidas: 214 },
      { medico: fernanda, faltas: 63, concluidas: 203 },
      { medico: roberto, faltas: 58, concluidas: 205 },
      { medico: ana, faltas: 52, concluidas: 196 },
      { medico: carlos, faltas: 46, concluidas: 188 },
      { medico: beatriz, faltas: 38, concluidas: 174 },
    ],
    diaTurno: [
      { turno: 'Manhã', taxas: [41, 27, 25, 24, 29] },
      { turno: 'Tarde', taxas: [30, 23, 22, 24, 33] },
    ],
    porTipo: [
      { tipo: 'convenio', faltas: 243, concluidas: 745 },
      { tipo: 'particular', faltas: 88, concluidas: 435 },
    ],
    porPrimeiraConsulta: [
      { primeiraConsulta: true, faltas: 121, concluidas: 311 },
      { primeiraConsulta: false, faltas: 210, concluidas: 869 },
    ],
    porAntecedencia: [
      { faixa: 'Até 7 dias', faltas: 41, concluidas: 244 },
      { faixa: '8 a 14 dias', faltas: 72, concluidas: 301 },
      { faixa: '15 a 21 dias', faltas: 104, concluidas: 337 },
      { faixa: '22 dias ou mais', faltas: 114, concluidas: 298 },
    ],
  }
}

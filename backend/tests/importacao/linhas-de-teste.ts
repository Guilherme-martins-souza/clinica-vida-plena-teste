import type { LinhaCsv, MedicoArquivo } from '../../src/importacao/ler-arquivos';
import type { ResultadoProcessamento } from '../../src/importacao/processar';

// Grade usada nos testes do processar. A data de referência dos testes é 24/09/2026 (quinta).
// 28/09/2026 é segunda e 29/09/2026 é terça.
export const MEDICOS: MedicoArquivo[] = [
  {
    id: 'MED01',
    nome: 'Dr. Paulo Mendes',
    especialidade: 'Cardiologia',
    grade: [
      { dia: 'segunda', inicio: '07:00', fim: '12:00' },
      { dia: 'quarta', inicio: '13:00', fim: '18:00' },
    ],
  },
  {
    id: 'MED02',
    nome: 'Dra. Ana Ribeiro',
    especialidade: 'Dermatologia',
    grade: [{ dia: 'terca', inicio: '08:00', fim: '12:00' }],
  },
];

// Monta uma linha válida (consulta futura agendada, dentro da grade); cada teste muda só o que precisa.
export function linha(numero: number, campos: Partial<Omit<LinhaCsv, 'linha'>> = {}): LinhaCsv {
  return {
    linha: numero,
    id: `AG${String(numero).padStart(5, '0')}`,
    paciente_id: 'PAC0001',
    paciente_nome: 'Maria Silva',
    paciente_telefone: '53948954499',
    tipo_atendimento: 'convenio',
    medico_id: 'MED01',
    data_agendamento: '2026-09-24 17:42',
    data_consulta: '2026-09-28 08:00',
    status: 'agendada',
    ...campos,
  };
}

// Motivo de descarte de cada linha descartada, pelo número da linha.
export function motivos(resultado: ResultadoProcessamento): Record<number, string> {
  return Object.fromEntries(resultado.descartes.map((d) => [d.linha, d.motivo]));
}

// Pesos e cortes do risco de falta num lugar só (RISCO-01). Para ajustar a conta, mexa só aqui.

export const PESOS = {
  // 2 ou mais faltas, ou taxa de faltas acima de 30%.
  historico: 40,
  // Primeira consulta do paciente na clínica.
  primeiraConsulta: 25,
  // Atendimento por convênio.
  convenio: 15,
  // Segunda-feira antes de 12:00.
  segundaDeManha: 15,
  // Faltam menos de 48 h e a consulta ainda não foi confirmada.
  semConfirmacao: 20,
} as const;

export type CodigoFator = keyof typeof PESOS;

// Pontuação mínima de cada nível: abaixo de `media` o risco é `baixo`.
export const CORTES = {
  media: 25,
  alta: 50,
  muitoAlta: 70,
} as const;

// Texto de cada fator, para a legenda da tela.
export const FATORES: { codigo: CodigoFator; rotulo: string }[] = [
  { codigo: 'historico', rotulo: 'Histórico de faltas (2 ou mais, ou mais de 30% dos atendimentos)' },
  { codigo: 'primeiraConsulta', rotulo: 'Primeira consulta na clínica' },
  { codigo: 'convenio', rotulo: 'Atendimento por convênio' },
  { codigo: 'segundaDeManha', rotulo: 'Segunda-feira de manhã (antes de 12:00)' },
  { codigo: 'semConfirmacao', rotulo: 'Sem confirmação a menos de 48 horas' },
];

// Taxa de faltas acima da qual o histórico pontua (30%) e antecedência mínima sem confirmação (48 h).
export const TAXA_FALTAS_ALTA = 0.3;
export const FALTAS_ALTO_RISCO = 2;
export const HORAS_SEM_CONFIRMACAO = 48;

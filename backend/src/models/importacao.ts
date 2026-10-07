import { Schema, model } from 'mongoose';

export const ORIGENS_IMPORTACAO = ['automatica', 'manual'] as const;
export type OrigemImportacao = (typeof ORIGENS_IMPORTACAO)[number];

export const SITUACOES_IMPORTACAO = ['em_andamento', 'concluida', 'falhou'] as const;
export type SituacaoImportacao = (typeof SITUACOES_IMPORTACAO)[number];

// Na ordem em que as regras são aplicadas: cada linha recebe só o primeiro motivo que se aplica.
export const MOTIVOS_DESCARTE = [
  'duplicada',
  'conflito_status',
  'conflito_horario',
  'conflito_horario_slot_ocupado',
  'conflito_dados',
  'campo_obrigatorio',
  'data_invalida',
  'medico_desconhecido',
  'tipo_desconhecido',
  'status_desconhecido',
  'status_vazio_passado',
  'fora_do_slot',
  'fora_da_grade',
  'resultado_no_futuro',
  'passada_sem_resultado',
] as const;
export type MotivoDescarte = (typeof MOTIVOS_DESCARTE)[number];

export const TIPOS_CORRECAO = [
  'status_padronizado',
  'cancelado_sem_autor',
  'status_vazio_futuro',
  'tipo_padronizado',
  'data_formato',
  'data_agendamento_invalida',
  'telefone_invalido',
  'nome_padronizado',
] as const;
export type TipoCorrecao = (typeof TIPOS_CORRECAO)[number];

// As 9 colunas do agendamentos.csv, na ordem do arquivo.
export const COLUNAS_CSV = [
  'id',
  'paciente_id',
  'paciente_nome',
  'paciente_telefone',
  'tipo_atendimento',
  'medico_id',
  'data_agendamento',
  'data_consulta',
  'status',
] as const;
export type ColunaCsv = (typeof COLUNAS_CSV)[number];

export interface TotaisImportacao {
  lidas: number;
  importadas: number;
  corrigidas: number;
  descartadas: number;
  medicos: number;
  pacientes: number;
}

export interface SlotDuplo {
  medicoId: string;
  inicio: Date;
  codigos: string[]; // ids (coluna id) das consultas no mesmo slot
}

export interface Descarte {
  linha: number; // número da linha no CSV (cabeçalho = 1)
  codigo: string; // coluna id
  motivo: MotivoDescarte;
  valores: Record<ColunaCsv, string>; // as 9 colunas como vieram
}

export interface DadosImportacao {
  origem: OrigemImportacao;
  situacao: SituacaoImportacao;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  erro: string | null;
  dataReferencia: Date | null;
  totais: TotaisImportacao | null;
  descartesPorMotivo: Partial<Record<MotivoDescarte, number>>;
  correcoesPorTipo: Partial<Record<TipoCorrecao, number>>;
  slotsDuplos: SlotDuplo[];
  descartes: Descarte[];
  arquivos: { json: string; csv: string } | null;
}

const totaisSchema = new Schema<TotaisImportacao>(
  {
    lidas: { type: Number, required: true },
    importadas: { type: Number, required: true },
    corrigidas: { type: Number, required: true },
    descartadas: { type: Number, required: true },
    medicos: { type: Number, required: true },
    pacientes: { type: Number, required: true },
  },
  { _id: false },
);

// Um campo numérico opcional para cada nome da lista (ex.: { duplicada: 40, fora_da_grade: 18 }).
function contagemPorNome(nomes: readonly string[]): Schema {
  return new Schema(Object.fromEntries(nomes.map((nome) => [nome, Number])), { _id: false });
}

const slotDuploSchema = new Schema<SlotDuplo>(
  {
    medicoId: { type: String, required: true },
    inicio: { type: Date, required: true },
    codigos: { type: [String], required: true },
  },
  { _id: false },
);

// Valores originais das 9 colunas; podem vir vazios.
const valoresCsvSchema = new Schema(
  Object.fromEntries(COLUNAS_CSV.map((coluna) => [coluna, { type: String, default: '' }])),
  { _id: false },
);

const descarteSchema = new Schema<Descarte>(
  {
    linha: { type: Number, required: true },
    codigo: { type: String, default: '' },
    motivo: { type: String, enum: MOTIVOS_DESCARTE, required: true },
    valores: { type: valoresCsvSchema, required: true },
  },
  { _id: false },
);

const arquivosSchema = new Schema(
  {
    json: { type: String, required: true },
    csv: { type: String, required: true },
  },
  { _id: false },
);

const importacaoSchema = new Schema<DadosImportacao>({
  origem: { type: String, enum: ORIGENS_IMPORTACAO, required: true },
  situacao: { type: String, enum: SITUACOES_IMPORTACAO, required: true },
  iniciadaEm: { type: Date, required: true },
  finalizadaEm: { type: Date, default: null },
  erro: { type: String, default: null },
  dataReferencia: { type: Date, default: null },
  totais: { type: totaisSchema, default: null },
  descartesPorMotivo: { type: contagemPorNome(MOTIVOS_DESCARTE), default: {} },
  correcoesPorTipo: { type: contagemPorNome(TIPOS_CORRECAO), default: {} },
  slotsDuplos: { type: [slotDuploSchema], default: [] },
  descartes: { type: [descarteSchema], default: [] },
  arquivos: { type: arquivosSchema, default: null },
});

// Lista da mais recente para a mais antiga.
importacaoSchema.index({ iniciadaEm: -1 });
// Trava: o próprio Mongo recusa uma segunda importação em andamento.
importacaoSchema.index({ situacao: 1 }, { unique: true, partialFilterExpression: { situacao: 'em_andamento' } });

export const Importacao = model<DadosImportacao>('Importacao', importacaoSchema, 'importacoes');

import { Schema, model } from 'mongoose';

export const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

// Hora no formato HH:mm, de 00:00 a 23:59.
export const HORA_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface HorarioGrade {
  dia: DiaSemana;
  inicio: string; // "07:00"
  fim: string; // "12:00"
}

export interface DadosMedico {
  _id: string; // o id do arquivo, ex.: "MED01"
  nome: string;
  especialidade: string;
  grade: HorarioGrade[];
}

const horarioSchema = new Schema<HorarioGrade>(
  {
    dia: { type: String, enum: DIAS_SEMANA, required: true },
    inicio: { type: String, required: true, match: HORA_HH_MM },
    fim: { type: String, required: true, match: HORA_HH_MM },
  },
  { _id: false },
);

// Como as horas têm sempre dois dígitos, comparar o texto compara o horário.
horarioSchema.pre('validate', function () {
  if (this.inicio && this.fim && this.inicio >= this.fim) {
    this.invalidate('fim', 'O fim do horário precisa ser depois do início');
  }
});

const medicoSchema = new Schema<DadosMedico>({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  especialidade: { type: String, required: true },
  grade: { type: [horarioSchema], default: [] },
});

export const Medico = model<DadosMedico>('Medico', medicoSchema, 'medicos');

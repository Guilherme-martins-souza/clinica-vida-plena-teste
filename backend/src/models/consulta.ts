import { Schema, model } from 'mongoose';
import { estaNoSlot } from '../consultas/regras';

export const STATUS_CONSULTA = [
  'agendada',
  'confirmada',
  'realizada',
  'falta',
  'cancelada_paciente',
  'cancelada_clinica',
] as const;
export type StatusConsulta = (typeof STATUS_CONSULTA)[number];

export const TIPOS_ATENDIMENTO = ['convenio', 'particular'] as const;
export type TipoAtendimento = (typeof TIPOS_ATENDIMENTO)[number];

export interface DadosConsulta {
  codigoLegado: string | null; // "AG00001" nas importadas; consultas novas não têm
  pacienteId: string;
  medicoId: string;
  tipoAtendimento: TipoAtendimento;
  inicio: Date; // data e hora da consulta
  marcadaEm: Date | null;
  canceladaEm: Date | null; // a importação deixa nulo
  status: StatusConsulta;
  consideradoFalta: boolean; // conta como falta: status `falta` ou cancelamento do paciente a menos de 24 h
}

const consultaSchema = new Schema<DadosConsulta>(
  {
    codigoLegado: { type: String, default: null },
    pacienteId: { type: String, required: true, ref: 'Paciente' },
    medicoId: { type: String, required: true, ref: 'Medico' },
    tipoAtendimento: { type: String, enum: TIPOS_ATENDIMENTO, required: true },
    inicio: {
      type: Date,
      required: true,
      validate: {
        validator: estaNoSlot,
        message: 'A consulta precisa começar no minuto 00 ou 30',
      },
    },
    marcadaEm: { type: Date, default: null },
    canceladaEm: { type: Date, default: null },
    status: { type: String, enum: STATUS_CONSULTA, required: true },
    consideradoFalta: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Agenda do médico num período, consultas do paciente e busca por data.
consultaSchema.index({ medicoId: 1, inicio: 1 });
consultaSchema.index({ pacienteId: 1, inicio: 1 });
consultaSchema.index({ inicio: 1 });
// Único só quando existe: várias consultas novas podem ficar sem código.
consultaSchema.index(
  { codigoLegado: 1 },
  { unique: true, partialFilterExpression: { codigoLegado: { $type: 'string' } } },
);

export const Consulta = model<DadosConsulta>('Consulta', consultaSchema, 'consultas');

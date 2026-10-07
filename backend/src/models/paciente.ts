import { Schema, model } from 'mongoose';

export interface DadosPaciente {
  _id: string; // o id do arquivo, ex.: "PAC0050"
  nome: string;
  telefone: string | null; // só dígitos: DDD + número (10 ou 11)
}

const pacienteSchema = new Schema<DadosPaciente>({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  telefone: { type: String, default: null, match: /^\d{10,11}$/ },
});

export const Paciente = model<DadosPaciente>('Paciente', pacienteSchema, 'pacientes');

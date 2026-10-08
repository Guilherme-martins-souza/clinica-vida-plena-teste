import { Schema, model } from 'mongoose';

export interface DadosPaciente {
  _id: string; // o id do arquivo, ex.: "PAC0050"
  nome: string;
  telefone: string | null; // só dígitos: DDD + número (10 ou 11)
  // Trava da criação de consulta (AD-005): cada consulta nova soma 1 aqui, dentro da transação.
  // Sem valor padrão: o $inc cria o campo na primeira consulta, e a importação grava os documentos como antes.
  versaoAgenda?: number;
}

const pacienteSchema = new Schema<DadosPaciente>({
  _id: { type: String, required: true },
  nome: { type: String, required: true },
  telefone: { type: String, default: null, match: /^\d{10,11}$/ },
  versaoAgenda: { type: Number },
});

export const Paciente = model<DadosPaciente>('Paciente', pacienteSchema, 'pacientes');

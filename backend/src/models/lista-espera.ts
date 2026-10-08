import { Schema, model } from 'mongoose';

export interface DadosListaEspera {
  nome: string;
  telefone: string; // só dígitos: DDD + número (10 ou 11)
  medicoId: string | null; // null = aceita qualquer médico
  antecipar: boolean; // só informativo: quer antecipar uma consulta que já tem
  criadoEm: Date;
}

const listaEsperaSchema = new Schema<DadosListaEspera>({
  nome: { type: String, required: true },
  telefone: { type: String, required: true, match: /^\d{10,11}$/ },
  medicoId: { type: String, default: null },
  antecipar: { type: Boolean, default: false },
  criadoEm: { type: Date, default: () => new Date() },
});

export const ListaEspera = model<DadosListaEspera>('ListaEspera', listaEsperaSchema, 'lista_espera');

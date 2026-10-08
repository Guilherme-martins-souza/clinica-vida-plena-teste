import { ListaEspera, type DadosListaEspera } from '../models/lista-espera';

// A pessoa mais antiga da espera que aceita esse médico (ou qualquer um). Não remove ninguém da lista.
export async function proximaDaEspera(medicoId: string): Promise<DadosListaEspera | null> {
  return ListaEspera.findOne({ medicoId: { $in: [medicoId, null] } })
    .sort({ criadoEm: 1, _id: 1 })
    .lean();
}

import { ListaEspera } from '../models/lista-espera';

// Telefones fictícios; MED01 e MED02 são ids do arquivo de médicos (a importação não precisa ter rodado).
const PESSOAS = [
  { nome: 'Helena Prado', telefone: '11955550001', medicoId: 'MED01', antecipar: false },
  { nome: 'Rafael Nunes', telefone: '11955550002', medicoId: null, antecipar: true },
  { nome: 'Camila Duarte', telefone: '1133330003', medicoId: 'MED02', antecipar: false },
  { nome: 'Bruno Teixeira', telefone: '11955550004', medicoId: null, antecipar: false },
  { nome: 'Larissa Freitas', telefone: '11955550005', medicoId: null, antecipar: true },
];

// Grava as 5 pessoas de exemplo só se a lista de espera está vazia.
export async function semearListaEspera(): Promise<void> {
  if ((await ListaEspera.countDocuments()) > 0) {
    return;
  }
  const agora = Date.now();
  // criadoEm escalonado em minutos para a ordem de cadastro ser sempre a mesma.
  await ListaEspera.insertMany(
    PESSOAS.map((pessoa, i) => ({ ...pessoa, criadoEm: new Date(agora - (PESSOAS.length - i) * 60000) })),
  );
}

import { ListaEspera } from '../models/lista-espera';

// Nomes e telefones fictícios; MED01 a MED06 são os ids do arquivo de médicos (a importação não precisa ter rodado).
// São 3 pessoas por médico; a terceira de cada um quer antecipar uma consulta que já tem.
const PESSOAS = [
  { nome: 'Helena Prado', telefone: '11955550001', medicoId: 'MED01', antecipar: false },
  { nome: 'Rafael Nunes', telefone: '11955550002', medicoId: 'MED01', antecipar: false },
  { nome: 'Larissa Freitas', telefone: '11955550003', medicoId: 'MED01', antecipar: true },
  { nome: 'Camila Duarte', telefone: '1133330004', medicoId: 'MED02', antecipar: false },
  { nome: 'Bruno Teixeira', telefone: '11955550005', medicoId: 'MED02', antecipar: false },
  { nome: 'Marina Castro', telefone: '11955550006', medicoId: 'MED02', antecipar: true },
  { nome: 'Pedro Almeida', telefone: '11955550007', medicoId: 'MED03', antecipar: false },
  { nome: 'Juliana Barros', telefone: '1133330008', medicoId: 'MED03', antecipar: false },
  { nome: 'Thiago Moreira', telefone: '11955550009', medicoId: 'MED03', antecipar: true },
  { nome: 'Patrícia Gomes', telefone: '11955550010', medicoId: 'MED04', antecipar: false },
  { nome: 'Lucas Ferreira', telefone: '11955550011', medicoId: 'MED04', antecipar: false },
  { nome: 'Renata Vieira', telefone: '1133330012', medicoId: 'MED04', antecipar: true },
  { nome: 'Gustavo Pinto', telefone: '11955550013', medicoId: 'MED05', antecipar: false },
  { nome: 'Aline Ribeiro', telefone: '11955550014', medicoId: 'MED05', antecipar: false },
  { nome: 'Felipe Cardoso', telefone: '11955550015', medicoId: 'MED05', antecipar: true },
  { nome: 'Vanessa Rocha', telefone: '11955550016', medicoId: 'MED06', antecipar: false },
  { nome: 'Diego Martins', telefone: '1133330017', medicoId: 'MED06', antecipar: false },
  { nome: 'Carolina Araújo', telefone: '11955550018', medicoId: 'MED06', antecipar: true },
];

// Grava as pessoas de exemplo (3 por médico) só se a lista de espera está vazia.
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

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErroFatal, lerAgendamentos, lerMedicos } from '../../src/importacao/ler-arquivos';

const DATA_DIR = process.env.DATA_DIR ?? '/data';
const CABECALHO =
  'id,paciente_id,paciente_nome,paciente_telefone,tipo_atendimento,medico_id,data_agendamento,data_consulta,status';

let pasta: string;

beforeAll(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ler-arquivos-'));
});

afterAll(async () => {
  await rm(pasta, { recursive: true, force: true });
});

// Grava o conteúdo num arquivo da pasta temporária e devolve o caminho.
async function arquivo(nome: string, conteudo: string): Promise<string> {
  const caminho = path.join(pasta, nome);
  await writeFile(caminho, conteudo);
  return caminho;
}

function medico(id: string, dia = 'segunda', inicio = '07:00', fim = '12:00') {
  return { id, nome: `Dr. ${id}`, especialidade: 'Cardiologia', grade: [{ dia, inicio, fim }] };
}

describe('lerMedicos', () => {
  it('lê um medicos.json válido', async () => {
    const caminho = await arquivo('medicos-ok.json', JSON.stringify([medico('MED01'), medico('MED02', 'sexta')]));

    expect(await lerMedicos(caminho)).toEqual([
      {
        id: 'MED01',
        nome: 'Dr. MED01',
        especialidade: 'Cardiologia',
        grade: [{ dia: 'segunda', inicio: '07:00', fim: '12:00' }],
      },
      {
        id: 'MED02',
        nome: 'Dr. MED02',
        especialidade: 'Cardiologia',
        grade: [{ dia: 'sexta', inicio: '07:00', fim: '12:00' }],
      },
    ]);
  });

  it('falha fatal quando o arquivo não existe', async () => {
    await expect(lerMedicos(path.join(pasta, 'nao-existe.json'))).rejects.toBeInstanceOf(ErroFatal);
  });

  it('falha fatal quando o JSON é inválido', async () => {
    const caminho = await arquivo('medicos-quebrado.json', '[{ "id": "MED01", ');
    await expect(lerMedicos(caminho)).rejects.toBeInstanceOf(ErroFatal);
  });

  it('falha fatal quando um dia da grade é inválido', async () => {
    const caminho = await arquivo('medicos-dia.json', JSON.stringify([medico('MED01', 'feriado')]));
    await expect(lerMedicos(caminho)).rejects.toBeInstanceOf(ErroFatal);
  });

  it('falha fatal quando há ids repetidos', async () => {
    const caminho = await arquivo(
      'medicos-repetidos.json',
      JSON.stringify([medico('MED01'), medico('MED01', 'sexta')]),
    );
    await expect(lerMedicos(caminho)).rejects.toBeInstanceOf(ErroFatal);
  });
});

describe('lerAgendamentos', () => {
  const LINHA_1 = 'AG00001,PAC0050,Patrícia Correia,54912341342,convenio,MED04,12/08/2025 12:48,2025-09-26 10:00,falta';
  const LINHA_2 =
    'AG00002,PAC0015,Pedro Batista,(53) 96470-3160,particular,MED04,2025-08-14 08:41,2025-09-25 08:00,realizada';

  it('lê CSV com \\r\\n sem deixar \\r nos valores, numerando as linhas a partir de 2', async () => {
    const caminho = await arquivo('crlf.csv', `${CABECALHO}\r\n${LINHA_1}\r\n${LINHA_2}\r\n`);

    const linhas = await lerAgendamentos(caminho);

    expect(linhas).toEqual([
      {
        linha: 2,
        id: 'AG00001',
        paciente_id: 'PAC0050',
        paciente_nome: 'Patrícia Correia',
        paciente_telefone: '54912341342',
        tipo_atendimento: 'convenio',
        medico_id: 'MED04',
        data_agendamento: '12/08/2025 12:48',
        data_consulta: '2025-09-26 10:00',
        status: 'falta',
      },
      {
        linha: 3,
        id: 'AG00002',
        paciente_id: 'PAC0015',
        paciente_nome: 'Pedro Batista',
        paciente_telefone: '(53) 96470-3160',
        tipo_atendimento: 'particular',
        medico_id: 'MED04',
        data_agendamento: '2025-08-14 08:41',
        data_consulta: '2025-09-25 08:00',
        status: 'realizada',
      },
    ]);
  });

  it('ignora linha em branco sem contá-la, mantendo o número real das linhas seguintes', async () => {
    const caminho = await arquivo('branco.csv', `${CABECALHO}\n${LINHA_1}\n\n${LINHA_2}\n`);

    const linhas = await lerAgendamentos(caminho);

    expect(linhas.map((l) => [l.linha, l.id])).toEqual([
      [2, 'AG00001'],
      [4, 'AG00002'],
    ]);
  });

  it('só com o cabeçalho devolve lista vazia', async () => {
    const caminho = await arquivo('so-cabecalho.csv', `${CABECALHO}\n`);
    expect(await lerAgendamentos(caminho)).toEqual([]);
  });

  it('falha fatal quando o cabeçalho tem uma coluna a menos', async () => {
    const caminho = await arquivo('coluna-a-menos.csv', `${CABECALHO.replace(',status', '')}\n`);
    await expect(lerAgendamentos(caminho)).rejects.toBeInstanceOf(ErroFatal);
  });

  it('falha fatal quando as colunas estão fora de ordem', async () => {
    const fora = CABECALHO.replace('paciente_id,paciente_nome', 'paciente_nome,paciente_id');
    const caminho = await arquivo('fora-de-ordem.csv', `${fora}\n`);
    await expect(lerAgendamentos(caminho)).rejects.toBeInstanceOf(ErroFatal);
  });

  it('falha fatal quando o arquivo não existe', async () => {
    await expect(lerAgendamentos(path.join(pasta, 'nao-existe.csv'))).rejects.toBeInstanceOf(ErroFatal);
  });
});

describe('arquivos reais de /data', () => {
  it('lê 7.359 linhas do agendamentos.csv e 6 médicos', async () => {
    const linhas = await lerAgendamentos(path.join(DATA_DIR, 'agendamentos.csv'));
    const medicos = await lerMedicos(path.join(DATA_DIR, 'medicos.json'));

    expect(linhas).toHaveLength(7359);
    expect(medicos).toHaveLength(6);
  });
});

import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { COLUNAS_CSV, type ColunaCsv } from '../models/importacao';
import { DIAS_SEMANA, HORA_HH_MM } from '../models/medico';

// Erro que impede a importação de rodar (arquivo ausente, formato errado).
// Acontece antes de qualquer gravação, então os dados do banco ficam como estavam.
export class ErroFatal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroFatal';
  }
}

const horarioSchema = z
  .object({
    dia: z.enum(DIAS_SEMANA),
    inicio: z.string().regex(HORA_HH_MM, 'hora no formato HH:mm'),
    fim: z.string().regex(HORA_HH_MM, 'hora no formato HH:mm'),
  })
  // As horas têm sempre dois dígitos, então comparar o texto compara o horário.
  .refine((h) => h.inicio < h.fim, { message: 'o fim do horário precisa ser depois do início', path: ['fim'] });

const medicosSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      nome: z.string().min(1),
      especialidade: z.string().min(1),
      grade: z.array(horarioSchema),
    }),
  )
  .refine((medicos) => new Set(medicos.map((m) => m.id)).size === medicos.length, {
    message: 'há médicos com o mesmo id',
  });

export type MedicoArquivo = z.infer<typeof medicosSchema>[number];

// Uma linha do agendamentos.csv: as 9 colunas como vieram e o número da linha no arquivo (cabeçalho = 1).
export type LinhaCsv = Record<ColunaCsv, string> & { linha: number };

async function lerTexto(caminho: string): Promise<string> {
  try {
    return await readFile(caminho, 'utf-8');
  } catch {
    throw new ErroFatal(`Não foi possível ler o arquivo ${caminho}`);
  }
}

export async function lerMedicos(caminho: string): Promise<MedicoArquivo[]> {
  const texto = await lerTexto(caminho);

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new ErroFatal(`O arquivo ${caminho} não é um JSON válido`);
  }

  const resultado = medicosSchema.safeParse(json);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((issue) => `${issue.path.join('.') || 'arquivo'}: ${issue.message}`);
    throw new ErroFatal(`O arquivo ${caminho} não está no formato esperado (${problemas.join('; ')})`);
  }
  return resultado.data;
}

export async function lerAgendamentos(caminho: string): Promise<LinhaCsv[]> {
  const texto = await lerTexto(caminho);

  // Cada registro vem como lista de valores. O on_record coloca na frente o número da linha
  // no arquivo, que continua certo mesmo quando uma linha em branco é pulada.
  let registros: string[][];
  try {
    registros = parse(texto, {
      bom: true,
      skip_empty_lines: true,
      on_record: (record, context) => [String(context.lines), ...record],
    });
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    throw new ErroFatal(`O arquivo ${caminho} não é um CSV válido: ${detalhe}`);
  }

  const [cabecalho, ...dados] = registros;
  const esperado = COLUNAS_CSV.join(',');
  if (!cabecalho || cabecalho.slice(1).join(',') !== esperado) {
    throw new ErroFatal(`O cabeçalho do arquivo ${caminho} precisa ser exatamente: ${esperado}`);
  }

  // Mesma ordem de COLUNAS_CSV (o cabeçalho já foi conferido).
  return dados.map(
    ([
      linha,
      id,
      paciente_id,
      paciente_nome,
      paciente_telefone,
      tipo_atendimento,
      medico_id,
      data_agendamento,
      data_consulta,
      status,
    ]) => ({
      linha: Number(linha),
      id,
      paciente_id,
      paciente_nome,
      paciente_telefone,
      tipo_atendimento,
      medico_id,
      data_agendamento,
      data_consulta,
      status,
    }),
  );
}

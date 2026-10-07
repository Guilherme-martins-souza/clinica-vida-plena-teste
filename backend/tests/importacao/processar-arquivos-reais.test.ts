import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { lerAgendamentos, lerMedicos, type LinhaCsv, type MedicoArquivo } from '../../src/importacao/ler-arquivos';
import { processar, type ResultadoProcessamento } from '../../src/importacao/processar';

const DATA_DIR = process.env.DATA_DIR ?? '/data';

let linhas: LinhaCsv[];
let medicos: MedicoArquivo[];
let resultado: ResultadoProcessamento;

beforeAll(async () => {
  linhas = await lerAgendamentos(path.join(DATA_DIR, 'agendamentos.csv'));
  medicos = await lerMedicos(path.join(DATA_DIR, 'medicos.json'));
  resultado = processar(linhas, medicos);
});

describe('processar sobre os arquivos reais de /data', () => {
  it('usa como data de referência o maior data_agendamento (24/09/2026 17:42)', () => {
    expect(resultado.dataReferencia?.toISOString()).toBe('2026-09-24T20:42:00.000Z');
  });

  it('lê 7.359 linhas, importa 7.153, descarta 206, com 6 médicos e 1.616 pacientes e 4.612 corrigidas', () => {
    expect(resultado.totais).toEqual({
      lidas: 7359,
      importadas: 7153,
      corrigidas: 4612,
      descartadas: 206,
      medicos: 6,
      pacientes: 1616,
    });
    expect(resultado.consultas).toHaveLength(7153);
    expect(resultado.descartes).toHaveLength(206);
    expect(resultado.medicos).toHaveLength(6);
    expect(resultado.pacientes).toHaveLength(1616);
  });

  it('descarta por motivo exatamente como na spec', () => {
    expect(resultado.descartesPorMotivo).toEqual({
      passada_sem_resultado: 69,
      duplicada: 40,
      conflito_status: 34,
      status_vazio_passado: 22,
      fora_da_grade: 18,
      resultado_no_futuro: 12,
      conflito_horario: 6,
      conflito_horario_slot_ocupado: 5,
    });
  });

  it('importa as consultas com os status da spec', () => {
    const porStatus: Record<string, number> = {};
    for (const consulta of resultado.consultas) {
      porStatus[consulta.status] = (porStatus[consulta.status] ?? 0) + 1;
    }

    expect(porStatus).toEqual({
      realizada: 4344,
      falta: 1986,
      cancelada_paciente: 306,
      agendada: 253,
      cancelada_clinica: 243,
      confirmada: 21,
    });
  });

  it('conta as correções por tipo como na spec', () => {
    expect(resultado.correcoesPorTipo).toEqual({
      status_padronizado: 2613,
      data_formato: 1900,
      tipo_padronizado: 1343,
      cancelado_sem_autor: 130,
      telefone_invalido: 129,
      nome_padronizado: 81,
      data_agendamento_invalida: 10,
      status_vazio_futuro: 2,
    });
  });

  it('aponta 82 slots com duas consultas ativas', () => {
    expect(resultado.slotsDuplos).toHaveLength(82);
  });

  it('rodar duas vezes sobre os mesmos arquivos dá o mesmo resultado', () => {
    expect(processar(linhas, medicos)).toEqual(resultado);
  });
});

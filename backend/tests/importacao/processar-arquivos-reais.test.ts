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

  it('lê 7.359 linhas, importa 7.071, descarta 288, com 6 médicos e 1.607 pacientes e 4.570 corrigidas', () => {
    expect(resultado.totais).toEqual({
      lidas: 7359,
      importadas: 7071,
      corrigidas: 4570,
      descartadas: 288,
      medicos: 6,
      pacientes: 1607,
    });
    expect(resultado.consultas).toHaveLength(7071);
    expect(resultado.descartes).toHaveLength(288);
    expect(resultado.medicos).toHaveLength(6);
    expect(resultado.pacientes).toHaveLength(1607);
  });

  it('descarta por motivo exatamente como na spec', () => {
    expect(resultado.descartesPorMotivo).toEqual({
      horario_ocupado: 82,
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
      realizada: 4270,
      falta: 1978,
      cancelada_paciente: 306,
      agendada: 253,
      cancelada_clinica: 243,
      confirmada: 21,
    });
  });

  it('conta as correções por tipo como na spec', () => {
    expect(resultado.correcoesPorTipo).toEqual({
      status_padronizado: 2591,
      data_formato: 1879,
      tipo_padronizado: 1329,
      cancelado_sem_autor: 130,
      telefone_invalido: 127,
      nome_padronizado: 81,
      data_agendamento_invalida: 10,
      status_vazio_futuro: 2,
    });
  });

  it('descarta como horario_ocupado a consulta marcada por último em cada um dos 82 horários duplos', () => {
    const ocupados = resultado.descartes.filter((d) => d.motivo === 'horario_ocupado').map((d) => d.codigo);
    const importadas = resultado.consultas.map((c) => c.codigoLegado);
    // 29/09/2025 11:00, MED04: AG00326 marcada 4 dias antes, AG00353 no próprio dia
    expect(ocupados).toContain('AG00353');
    expect(importadas).toContain('AG00326');
    // 30/06/2026 11:30, MED04: AG05281 está sem data de marcação, vale a ordem do arquivo
    expect(ocupados).toContain('AG05531');
    expect(importadas).toContain('AG05281');
  });

  it('nenhum médico fica com duas consultas ativas no mesmo horário', () => {
    const ativas = resultado.consultas.filter((c) => !c.status.startsWith('cancelada'));
    const slots = new Set(ativas.map((c) => `${c.medicoId}|${c.inicio.toISOString()}`));
    expect(slots.size).toBe(ativas.length);
  });

  it('rodar duas vezes sobre os mesmos arquivos dá o mesmo resultado', () => {
    expect(processar(linhas, medicos)).toEqual(resultado);
  });
});

import { describe, expect, it } from 'vitest';
import type { LinhaCsv } from '../../src/importacao/ler-arquivos';
import { processar } from '../../src/importacao/processar';
import { MEDICOS, linha, motivos } from './linhas-de-teste';

// Linha que só serve para fixar a data de referência em 24/09/2026 17:42 (futura e válida).
const REFERENCIA = linha(99, { id: 'AGREF', paciente_id: 'PAC0099', data_consulta: '2026-09-30 14:00' });

// Processa a linha junto com a de referência e devolve o motivo do descarte dela (ou undefined).
function motivoDe(campos: Partial<Omit<LinhaCsv, 'linha'>>): string | undefined {
  return motivos(processar([linha(2, campos), REFERENCIA], MEDICOS))[2];
}

describe('um motivo por regra', () => {
  it.each(['id', 'paciente_id', 'paciente_nome', 'medico_id', 'data_agendamento', 'data_consulta'] as const)(
    'campo obrigatório vazio (%s) → campo_obrigatorio',
    (coluna) => {
      expect(motivoDe({ [coluna]: '' })).toBe('campo_obrigatorio');
    },
  );

  it('data ilegível → data_invalida', () => {
    expect(motivoDe({ data_consulta: '31/02/2026 10:00' })).toBe('data_invalida');
    expect(motivoDe({ data_agendamento: 'ontem' })).toBe('data_invalida');
  });

  it('médico fora do medicos.json → medico_desconhecido', () => {
    expect(motivoDe({ medico_id: 'MED99' })).toBe('medico_desconhecido');
  });

  it('tipo fora da lista → tipo_desconhecido', () => {
    expect(motivoDe({ tipo_atendimento: 'outro' })).toBe('tipo_desconhecido');
  });

  it('status fora da tabela → status_desconhecido', () => {
    expect(motivoDe({ status: 'talvez' })).toBe('status_desconhecido');
  });

  it('status vazio numa consulta passada → status_vazio_passado', () => {
    expect(motivoDe({ status: '', data_agendamento: '2026-09-01 10:00', data_consulta: '2026-09-21 08:00' })).toBe(
      'status_vazio_passado',
    );
  });

  it('minuto diferente de 00 e 30 → fora_do_slot', () => {
    expect(motivoDe({ data_consulta: '2026-09-28 08:15' })).toBe('fora_do_slot');
  });

  it('dia sem grade do médico → fora_da_grade', () => {
    // 29/09/2026 é terça; o MED01 só atende segunda e quarta
    expect(motivoDe({ data_consulta: '2026-09-29 08:00' })).toBe('fora_da_grade');
  });

  it('horário fora da grade do médico → fora_da_grade', () => {
    // MED01 atende segunda das 07:00 às 12:00: a última consulta começa às 11:30
    expect(motivoDe({ data_consulta: '2026-09-28 06:00' })).toBe('fora_da_grade');
    expect(motivoDe({ data_consulta: '2026-09-28 12:00' })).toBe('fora_da_grade');
    expect(motivoDe({ data_consulta: '2026-09-28 11:30' })).toBeUndefined();
    expect(motivoDe({ data_consulta: '2026-09-28 07:00' })).toBeUndefined();
  });

  it('consulta futura com resultado → resultado_no_futuro', () => {
    expect(motivoDe({ status: 'realizada' })).toBe('resultado_no_futuro');
    expect(motivoDe({ status: 'faltou' })).toBe('resultado_no_futuro');
  });

  it('consulta passada ainda agendada ou confirmada → passada_sem_resultado', () => {
    const passada = { data_agendamento: '2026-09-01 10:00', data_consulta: '2026-09-21 08:00' };
    expect(motivoDe({ ...passada, status: 'agendada' })).toBe('passada_sem_resultado');
    expect(motivoDe({ ...passada, status: 'confirmado' })).toBe('passada_sem_resultado');
  });
});

describe('ordem dos motivos', () => {
  it('linha com dois problemas recebe só o primeiro da ordem', () => {
    expect(motivoDe({ medico_id: 'MED99', tipo_atendimento: 'outro' })).toBe('medico_desconhecido');
    expect(motivoDe({ tipo_atendimento: 'outro', status: 'talvez' })).toBe('tipo_desconhecido');
    expect(motivoDe({ data_consulta: '2026-09-29 08:15', status: 'realizada' })).toBe('fora_do_slot');

    const resultado = processar([linha(2, { medico_id: 'MED99', tipo_atendimento: 'outro' }), REFERENCIA], MEDICOS);
    expect(resultado.descartes.filter((d) => d.linha === 2)).toHaveLength(1);
  });
});

describe('passado e futuro', () => {
  it('consulta exatamente na data de referência é passada', () => {
    // A data de referência é 28/09/2026 08:00, o mesmo instante da consulta.
    const naReferencia = { data_agendamento: '2026-09-28 08:00', data_consulta: '2026-09-28 08:00' };

    expect(motivos(processar([linha(2, { ...naReferencia, status: 'agendada' })], MEDICOS))).toEqual({
      2: 'passada_sem_resultado',
    });
    expect(motivos(processar([linha(2, { ...naReferencia, status: 'realizada' })], MEDICOS))).toEqual({});
  });
});

describe('correções e consultas montadas', () => {
  it('status vazio numa consulta futura vira agendada com a correção status_vazio_futuro', () => {
    const resultado = processar([linha(2, { status: '' })], MEDICOS);

    expect(resultado.consultas.map((c) => c.status)).toEqual(['agendada']);
    expect(resultado.correcoesPorTipo).toEqual({ status_vazio_futuro: 1 });
  });

  it('marcação depois da consulta: entra sem data de marcação e com a correção data_agendamento_invalida', () => {
    const resultado = processar(
      [
        linha(2, { data_agendamento: '2026-09-22 08:00', data_consulta: '2026-09-21 08:00', status: 'realizada' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({});
    expect(resultado.consultas.find((c) => c.codigoLegado === 'AG00002')?.marcadaEm).toBeNull();
    expect(resultado.correcoesPorTipo).toEqual({ data_agendamento_invalida: 1 });
  });

  it('consulta cancelada entra com a data do cancelamento vazia', () => {
    const resultado = processar([linha(2, { status: 'cancelada_paciente' })], MEDICOS);

    expect(resultado.consultas).toHaveLength(1);
    expect(resultado.consultas[0].status).toBe('cancelada_paciente');
    expect(resultado.consultas[0].canceladaEm).toBeNull();
  });

  it('monta a consulta com os valores normalizados e conta cada correção da linha', () => {
    const resultado = processar(
      [
        linha(2, {
          id: 'AG00010',
          paciente_id: 'PAC0050',
          paciente_telefone: '92916',
          tipo_atendimento: 'Convênio',
          medico_id: 'MED02',
          data_agendamento: '20/09/2026 09:15',
          data_consulta: '29/09/2026 08:30',
          status: 'Confirmado',
        }),
        linha(3, { id: 'AG00011', status: 'cancelado' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.consultas.find((c) => c.codigoLegado === 'AG00010')).toEqual({
      codigoLegado: 'AG00010',
      pacienteId: 'PAC0050',
      medicoId: 'MED02',
      tipoAtendimento: 'convenio',
      inicio: new Date('2026-09-29T11:30:00.000Z'),
      marcadaEm: new Date('2026-09-20T12:15:00.000Z'),
      canceladaEm: null,
      status: 'confirmada',
    });
    expect(resultado.consultas.find((c) => c.codigoLegado === 'AG00011')?.status).toBe('cancelada_clinica');
    expect(resultado.correcoesPorTipo).toEqual({
      status_padronizado: 1,
      tipo_padronizado: 1,
      data_formato: 1,
      telefone_invalido: 1,
      cancelado_sem_autor: 1,
    });
  });

  it('linha descartada não conta correção', () => {
    const resultado = processar([linha(2, { tipo_atendimento: 'Convênio', status: 'talvez' })], MEDICOS);

    expect(resultado.consultas).toEqual([]);
    expect(resultado.correcoesPorTipo).toEqual({});
  });
});

describe('destino de cada linha', () => {
  it('cada linha é importada ou descartada uma única vez', () => {
    const linhas = [
      linha(2),
      linha(3, { id: 'AG00002' }), // cópia idêntica da linha 2
      linha(4, { status: 'realizada' }),
      linha(5, { medico_id: 'MED99' }),
      linha(6, { status: 'cancelado' }),
      linha(7, { data_consulta: '2026-09-28 09:00', status: '' }),
      linha(8, { id: 'AG9', status: 'agendada' }),
      linha(9, { id: 'AG9', status: 'confirmada' }),
      REFERENCIA,
    ];

    const resultado = processar(linhas, MEDICOS);

    const descartadas = resultado.descartes.map((d) => d.linha);
    expect(new Set(descartadas).size).toBe(descartadas.length);
    expect(resultado.consultas.length + resultado.descartes.length).toBe(linhas.length);
    expect(resultado.consultas.map((c) => c.codigoLegado).sort()).toEqual(['AG00002', 'AG00006', 'AG00007', 'AGREF']);
  });
});

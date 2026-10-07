import { describe, expect, it } from 'vitest';
import { processar } from '../../src/importacao/processar';
import { MEDICOS, linha, motivos } from './linhas-de-teste';

describe('data de referência', () => {
  it('é o maior data_agendamento legível do arquivo, ignorando os ilegíveis', () => {
    const resultado = processar(
      [
        linha(2, { data_agendamento: '2026-09-20 10:00' }),
        linha(3, { data_agendamento: '24/09/2026 17:42' }),
        linha(4, { data_agendamento: 'ontem' }),
        linha(5, { data_agendamento: '2026-09-22 09:00' }),
      ],
      MEDICOS,
    );

    // 17:42 em São Paulo = 20:42 UTC
    expect(resultado.dataReferencia?.toISOString()).toBe('2026-09-24T20:42:00.000Z');
  });
});

describe('linhas idênticas', () => {
  it('fica a primeira e as cópias saem como duplicada', () => {
    const original = linha(2);
    const resultado = processar([original, { ...original, linha: 3 }, { ...original, linha: 4 }], MEDICOS);

    expect(motivos(resultado)).toEqual({ 3: 'duplicada', 4: 'duplicada' });
  });

  it('guarda o número da linha, o id e os valores originais das 9 colunas no descarte', () => {
    const original = linha(2, { status: 'Agendada' });
    const resultado = processar([original, { ...original, linha: 3 }], MEDICOS);

    expect(resultado.descartes).toEqual([
      {
        linha: 3,
        codigo: 'AG00002',
        motivo: 'duplicada',
        valores: {
          id: 'AG00002',
          paciente_id: 'PAC0001',
          paciente_nome: 'Maria Silva',
          paciente_telefone: '53948954499',
          tipo_atendimento: 'convenio',
          medico_id: 'MED01',
          data_agendamento: '2026-09-24 17:42',
          data_consulta: '2026-09-28 08:00',
          status: 'Agendada',
        },
      },
    ]);
  });
});

describe('mesmo id com versões diferentes', () => {
  it('só o status diferente: todas as versões saem como conflito_status', () => {
    const resultado = processar(
      [linha(2, { id: 'AG1', status: 'agendada' }), linha(3, { id: 'AG1', status: 'confirmada' })],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 2: 'conflito_status', 3: 'conflito_status' });
  });

  it('só o horário diferente e uma versão em slot ocupado por outra consulta ativa: fica a livre', () => {
    const resultado = processar(
      [
        linha(2, { id: 'AG1', data_consulta: '2026-09-28 08:00' }),
        linha(3, { id: 'AG1', data_consulta: '2026-09-28 08:30' }),
        // outra consulta ativa do mesmo médico às 08:30 (escrita no outro formato de data)
        linha(4, { id: 'AG2', paciente_id: 'PAC0002', data_consulta: '28/09/2026 08:30', status: 'confirmada' }),
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 3: 'conflito_horario_slot_ocupado' });
  });

  it('slot ocupado só por consulta cancelada conta como livre', () => {
    const resultado = processar(
      [
        linha(2, { id: 'AG1', data_consulta: '2026-09-28 08:00' }),
        linha(3, { id: 'AG1', data_consulta: '2026-09-28 08:30' }),
        linha(4, { id: 'AG2', paciente_id: 'PAC0002', data_consulta: '2026-09-28 08:30', status: 'cancelado' }),
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 2: 'conflito_horario', 3: 'conflito_horario' });
  });

  it('só o horário diferente e as duas versões livres: as duas saem como conflito_horario', () => {
    const resultado = processar(
      [
        linha(2, { id: 'AG1', data_consulta: '2026-09-28 08:00' }),
        linha(3, { id: 'AG1', data_consulta: '2026-09-28 08:30' }),
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 2: 'conflito_horario', 3: 'conflito_horario' });
  });

  it('só o horário diferente e nenhuma versão livre: as duas saem como conflito_horario', () => {
    const resultado = processar(
      [
        linha(2, { id: 'AG1', data_consulta: '2026-09-28 08:00' }),
        linha(3, { id: 'AG1', data_consulta: '2026-09-28 08:30' }),
        linha(4, { id: 'AG2', paciente_id: 'PAC0002', data_consulta: '2026-09-28 08:00' }),
        linha(5, { id: 'AG3', paciente_id: 'PAC0003', data_consulta: '2026-09-28 08:30' }),
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 2: 'conflito_horario', 3: 'conflito_horario' });
  });

  it('outro campo diferente (nome): todas as versões saem como conflito_dados', () => {
    const resultado = processar(
      [linha(2, { id: 'AG1', paciente_nome: 'Maria Silva' }), linha(3, { id: 'AG1', paciente_nome: 'Maria Souza' })],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 2: 'conflito_dados', 3: 'conflito_dados' });
  });

  it('status e horário diferentes ao mesmo tempo: todas as versões saem como conflito_dados', () => {
    const resultado = processar(
      [
        linha(2, { id: 'AG1', data_consulta: '2026-09-28 08:00', status: 'agendada' }),
        linha(3, { id: 'AG1', data_consulta: '2026-09-28 08:30', status: 'confirmada' }),
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 2: 'conflito_dados', 3: 'conflito_dados' });
  });
});

import { describe, expect, it } from 'vitest';
import { processar } from '../../src/importacao/processar';
import { MEDICOS, linha, motivos } from './linhas-de-teste';

// Fixa a data de referência em 24/09/2026 17:42 (linha futura e válida, de outro paciente).
const REFERENCIA = linha(99, { id: 'AGREF', paciente_id: 'PAC0099', paciente_nome: 'Referência' });

describe('pacientes', () => {
  it('paciente que só tem linhas descartadas não é criado', () => {
    const resultado = processar(
      [
        linha(2, { paciente_id: 'PAC0005', medico_id: 'MED99' }),
        linha(3, { paciente_id: 'PAC0005', status: 'talvez' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.pacientes.map((p) => p._id)).toEqual(['PAC0099']);
  });

  it('nome mais frequente (sem espaços extras) e telefone da consulta mais recente com telefone válido', () => {
    const resultado = processar(
      [
        // 05/10 é a consulta mais recente com telefone válido, mesmo estando antes no arquivo
        linha(2, {
          paciente_nome: 'ANA LIMA',
          paciente_telefone: '(53) 91111-2222',
          data_consulta: '2026-10-05 08:00',
        }),
        linha(3, { paciente_nome: 'Ana Lima', paciente_telefone: '53933334444', data_consulta: '2026-09-28 08:00' }),
        // 12/10 é a mais recente, mas o telefone é inválido
        linha(4, { paciente_nome: 'Ana  Lima ', paciente_telefone: 'sem telefone', data_consulta: '2026-10-12 08:00' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.pacientes.find((p) => p._id === 'PAC0001')).toEqual({
      _id: 'PAC0001',
      nome: 'Ana Lima',
      telefone: '53911112222',
    });
  });

  it('paciente sem nenhum telefone válido fica sem telefone', () => {
    const resultado = processar(
      [
        linha(2, { paciente_telefone: '' }),
        linha(3, { paciente_telefone: '92916', data_consulta: '2026-10-05 08:00' }),
      ],
      MEDICOS,
    );

    expect(resultado.pacientes).toEqual([{ _id: 'PAC0001', nome: 'Maria Silva', telefone: null }]);
  });

  it('nome_padronizado só nas linhas com grafia diferente da escolhida; corrigidas conta linhas, não correções', () => {
    const resultado = processar(
      [
        linha(2, { paciente_nome: 'ANA LIMA' }), // nome_padronizado
        linha(3, { paciente_nome: 'Ana Lima', data_consulta: '2026-09-28 08:30' }), // sem correção
        linha(4, { paciente_nome: 'Ana  Lima ', paciente_telefone: 'sem telefone', data_consulta: '2026-09-28 09:00' }), // nome_padronizado + telefone_invalido
        linha(5, { paciente_nome: 'Ana Lima', data_consulta: '2026-09-28 09:30' }), // sem correção
      ],
      MEDICOS,
    );

    expect(resultado.correcoesPorTipo).toEqual({ nome_padronizado: 2, telefone_invalido: 1 });
    expect(resultado.totais.corrigidas).toBe(2);
  });
});

describe('horário do médico já ocupado', () => {
  // 21/09/2026 08:00 (segunda) é passado em relação à referência
  const passada = { data_agendamento: '2026-09-01 10:00', data_consulta: '2026-09-21 08:00', status: 'realizada' };

  it('duas consultas ativas no mesmo slot do médico: fica a marcada primeiro e a outra sai como horario_ocupado', () => {
    const resultado = processar(
      [
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001', status: 'falta' }),
        linha(3, { ...passada, id: 'AG2', paciente_id: 'PAC0002', data_agendamento: '2026-09-20 15:00' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.consultas.map((c) => c.codigoLegado)).toEqual(['AG1', 'AGREF']);
    expect(motivos(resultado)).toEqual({ 3: 'horario_ocupado' });
  });

  it('a consulta marcada depois é a descartada, mesmo vindo antes no arquivo', () => {
    const resultado = processar(
      [
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001', data_agendamento: '2026-09-20 15:00' }),
        linha(3, { ...passada, id: 'AG2', paciente_id: 'PAC0002', data_agendamento: '2026-09-10 09:00' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({ 2: 'horario_ocupado' });
  });

  it('marcadas no mesmo instante ou sem data de marcação: vale a ordem do arquivo', () => {
    const resultado = processar(
      [
        // marcação depois da consulta: entra sem data de marcação
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001', data_agendamento: '2026-09-23 08:00' }),
        linha(3, { ...passada, id: 'AG2', paciente_id: 'PAC0002', data_agendamento: '2026-09-20 15:00' }),
        linha(4, { ...passada, id: 'AG3', paciente_id: 'PAC0003', data_agendamento: '2026-09-20 15:00' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.consultas[0]).toMatchObject({ codigoLegado: 'AG1', marcadaEm: null });
    expect(motivos(resultado)).toEqual({ 3: 'horario_ocupado', 4: 'horario_ocupado' });
  });

  it('consulta cancelada não ocupa o horário', () => {
    const resultado = processar(
      [
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001', status: 'cancelado pelo paciente' }),
        linha(3, { ...passada, id: 'AG2', paciente_id: 'PAC0002', data_agendamento: '2026-09-20 15:00' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.consultas).toHaveLength(3);
    expect(motivos(resultado)).toEqual({});
  });

  it('mesmo horário com médicos diferentes não é horário ocupado', () => {
    const resultado = processar(
      [
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001' }),
        linha(3, {
          ...passada,
          id: 'AG2',
          paciente_id: 'PAC0002',
          medico_id: 'MED02',
          data_consulta: '2026-09-22 08:00',
        }),
        linha(4, { ...passada, id: 'AG3', paciente_id: 'PAC0003', data_consulta: '2026-09-21 08:30' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(motivos(resultado)).toEqual({});
  });

  it('paciente que só tinha a consulta descartada não é criado e a linha não conta correção', () => {
    const resultado = processar(
      [
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001' }),
        linha(3, { ...passada, id: 'AG2', paciente_id: 'PAC0002', tipo_atendimento: 'Convênio' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.pacientes.map((p) => p._id)).toEqual(['PAC0001', 'PAC0099']);
    expect(resultado.correcoesPorTipo).toEqual({});
  });
});

describe('horário do paciente já ocupado', () => {
  // Um terceiro médico que também atende segunda de manhã, para o paciente ter duas consultas no mesmo início.
  const COM_MED03 = [
    ...MEDICOS,
    {
      id: 'MED03',
      nome: 'Dr. Carlos Souza',
      especialidade: 'Ortopedia',
      grade: [{ dia: 'segunda' as const, inicio: '07:00', fim: '12:00' }],
    },
  ];
  const passada = { data_consulta: '2026-09-21 08:00', status: 'realizada', paciente_id: 'PAC0001' };

  it('mesmo paciente no mesmo início com médicos diferentes: fica a marcada primeiro e a outra sai como horario_ocupado', () => {
    const resultado = processar(
      [
        // No arquivo vem antes, mas foi marcada depois: é a descartada.
        linha(2, { ...passada, id: 'AG1', medico_id: 'MED03', data_agendamento: '2026-09-15 10:00' }),
        linha(3, { ...passada, id: 'AG2', medico_id: 'MED01', data_agendamento: '2026-09-01 10:00' }),
        REFERENCIA,
      ],
      COM_MED03,
    );

    expect(resultado.consultas.map((c) => c.codigoLegado)).toEqual(['AG2', 'AGREF']);
    expect(motivos(resultado)).toEqual({ 2: 'horario_ocupado' });
  });
});

describe('totais e contagens', () => {
  it('soma lidas, importadas, corrigidas, descartadas, médicos e pacientes, e conta os descartes por motivo', () => {
    const resultado = processar(
      [
        linha(2, { paciente_id: 'PAC0001' }),
        linha(3, { id: 'AG00002', paciente_id: 'PAC0001' }), // cópia da linha 2
        linha(4, { paciente_id: 'PAC0002', tipo_atendimento: 'Particular', data_consulta: '2026-09-28 08:30' }), // corrigida
        linha(5, { paciente_id: 'PAC0003', status: 'realizada' }), // resultado_no_futuro
        linha(6, { paciente_id: 'PAC0004', medico_id: 'MED99' }), // medico_desconhecido
        linha(7, { paciente_id: 'PAC0002', status: 'faltou' }), // resultado_no_futuro
      ],
      MEDICOS,
    );

    expect(resultado.totais).toEqual({
      lidas: 6,
      importadas: 2,
      corrigidas: 1,
      descartadas: 4,
      medicos: 2,
      pacientes: 2,
    });
    expect(resultado.descartesPorMotivo).toEqual({ duplicada: 1, resultado_no_futuro: 2, medico_desconhecido: 1 });
  });

  it('devolve os médicos do arquivo no formato do banco', () => {
    const resultado = processar([], MEDICOS);

    expect(resultado.medicos).toEqual([
      { _id: 'MED01', nome: 'Dr. Paulo Mendes', especialidade: 'Cardiologia', grade: MEDICOS[0].grade },
      { _id: 'MED02', nome: 'Dra. Ana Ribeiro', especialidade: 'Dermatologia', grade: MEDICOS[1].grade },
    ]);
  });

  it('CSV só com o cabeçalho: 0 lidas, 0 importadas e 0 descartadas', () => {
    const resultado = processar([], MEDICOS);

    expect(resultado.totais).toEqual({
      lidas: 0,
      importadas: 0,
      corrigidas: 0,
      descartadas: 0,
      medicos: 2,
      pacientes: 0,
    });
    expect(resultado.dataReferencia).toBeNull();
  });
});

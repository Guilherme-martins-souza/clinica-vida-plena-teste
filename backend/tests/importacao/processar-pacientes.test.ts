import { describe, expect, it } from 'vitest';
import { processar } from '../../src/importacao/processar';
import { MEDICOS, linha } from './linhas-de-teste';

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
        linha(3, { paciente_nome: 'Ana Lima' }), // sem correção
        linha(4, { paciente_nome: 'Ana  Lima ', paciente_telefone: 'sem telefone' }), // nome_padronizado + telefone_invalido
        linha(5, { paciente_nome: 'Ana Lima' }), // sem correção
      ],
      MEDICOS,
    );

    expect(resultado.correcoesPorTipo).toEqual({ nome_padronizado: 2, telefone_invalido: 1 });
    expect(resultado.totais.corrigidas).toBe(2);
  });
});

describe('slots com duas consultas ativas', () => {
  // 21/09/2026 08:00 (segunda) é passado em relação à referência
  const passada = { data_agendamento: '2026-09-01 10:00', data_consulta: '2026-09-21 08:00' };

  it('falta e realizada no mesmo slot do médico: as duas entram e o slot vira um aviso', () => {
    const resultado = processar(
      [
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001', status: 'falta' }),
        linha(3, { ...passada, id: 'AG2', paciente_id: 'PAC0002', status: 'realizada' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.consultas.map((c) => c.codigoLegado)).toEqual(['AG1', 'AG2', 'AGREF']);
    expect(resultado.slotsDuplos).toEqual([
      { medicoId: 'MED01', inicio: new Date('2026-09-21T11:00:00.000Z'), codigos: ['AG1', 'AG2'] },
    ]);
  });

  it('uma consulta ativa e uma cancelada no mesmo slot não geram aviso', () => {
    const resultado = processar(
      [
        linha(2, { ...passada, id: 'AG1', paciente_id: 'PAC0001', status: 'realizada' }),
        linha(3, { ...passada, id: 'AG2', paciente_id: 'PAC0002', status: 'cancelado pelo paciente' }),
        REFERENCIA,
      ],
      MEDICOS,
    );

    expect(resultado.consultas).toHaveLength(3);
    expect(resultado.slotsDuplos).toEqual([]);
  });
});

describe('totais e contagens', () => {
  it('soma lidas, importadas, corrigidas, descartadas, médicos e pacientes, e conta os descartes por motivo', () => {
    const resultado = processar(
      [
        linha(2, { paciente_id: 'PAC0001' }),
        linha(3, { id: 'AG00002', paciente_id: 'PAC0001' }), // cópia da linha 2
        linha(4, { paciente_id: 'PAC0002', tipo_atendimento: 'Particular' }), // corrigida
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

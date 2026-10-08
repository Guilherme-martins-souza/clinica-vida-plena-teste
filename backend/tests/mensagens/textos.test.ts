import { describe, expect, it } from 'vitest';
import { linkGoogleCalendar } from '../../src/mensagens/link-calendario';
import { textoConfirmacao, textoCriada, textoLembrete, textoVaga } from '../../src/mensagens/textos';

// 12/10/2026 às 09:00 em São Paulo (12:00 UTC).
const dados = { paciente: 'Maria Silva', medico: 'Dr. Paulo Mendes', inicio: new Date('2026-10-12T12:00:00Z') };
const OPCOES = '\n\nResponda:\n1 - Confirmar\n2 - Remarcar\n3 - Cancelar';

describe('textos das mensagens', () => {
  it('mensagem 1 traz os dados, o link do calendário e o aviso das 24h', () => {
    const link = linkGoogleCalendar({
      titulo: 'Consulta com Dr. Paulo Mendes',
      inicio: dados.inicio,
      local: 'Clínica Vida Plena',
    });
    expect(textoCriada(dados)).toBe(
      'Clínica Vida Plena\n\n' +
        'Olá, Maria Silva! Sua consulta com Dr. Paulo Mendes está marcada para 12/10/2026 às 09:00.\n\n' +
        `Adicione ao seu calendário: ${link}\n\n` +
        'Cancelamentos devem ser feitos com no mínimo 24h de antecedência, sob pena de cobrança.',
    );
  });

  it('mensagem 2 pede a confirmação e termina com as opções', () => {
    expect(textoConfirmacao(dados)).toBe(
      'Clínica Vida Plena\n\n' +
        'Olá, Maria Silva! Você confirma sua consulta com Dr. Paulo Mendes em 12/10/2026 às 09:00?' +
        OPCOES,
    );
  });

  it('mensagem 3 é o lembrete e termina com as opções', () => {
    expect(textoLembrete(dados)).toBe(
      'Clínica Vida Plena\n\n' +
        'Olá, Maria Silva! Lembrete: sua consulta com Dr. Paulo Mendes é em 12/10/2026 às 09:00.' +
        OPCOES,
    );
  });

  it('mensagem 4 oferece a vaga com dia, hora e médico e termina com as opções', () => {
    expect(textoVaga(dados)).toBe(
      'Clínica Vida Plena\n\n' +
        'Olá, Maria Silva! Surgiu uma vaga disponível em 12/10/2026 às 09:00 com Dr. Paulo Mendes. Você quer ficar com ela?' +
        OPCOES,
    );
  });

  it('data e hora vêm em São Paulo, mesmo virando o dia em UTC', () => {
    // 23:30 em São Paulo = 02:30 do dia seguinte em UTC.
    const texto = textoLembrete({ ...dados, inicio: new Date('2026-10-13T02:30:00Z') });
    expect(texto).toContain('12/10/2026 às 23:30');
  });
});

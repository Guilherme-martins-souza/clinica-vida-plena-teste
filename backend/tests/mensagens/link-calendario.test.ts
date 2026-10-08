import { describe, expect, it } from 'vitest';
import { linkGoogleCalendar } from '../../src/mensagens/link-calendario';

describe('linkGoogleCalendar', () => {
  const link = linkGoogleCalendar({
    titulo: 'Consulta com Dr. Paulo',
    inicio: new Date('2026-10-12T09:00:00-03:00'),
    local: 'Clínica Vida Plena',
  });
  const url = new URL(link);

  it('usa a URL de criação de evento do Google Calendar', () => {
    expect(link.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE')).toBe(true);
  });

  it('manda início e fim em UTC com 30 minutos de duração', () => {
    expect(url.searchParams.get('dates')).toBe('20261012T120000Z/20261012T123000Z');
  });

  it('codifica título e local', () => {
    expect(link).not.toContain(' ');
    expect(url.searchParams.get('text')).toBe('Consulta com Dr. Paulo');
    expect(url.searchParams.get('location')).toBe('Clínica Vida Plena');
  });
});

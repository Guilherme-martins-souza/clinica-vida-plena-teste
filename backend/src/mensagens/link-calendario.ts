const DURACAO_MINUTOS = 30;

export interface DadosLinkCalendario {
  titulo: string;
  inicio: Date;
  local: string;
}

// 2026-10-12T12:00:00.000Z → "20261012T120000Z"
function dataParaGoogle(data: Date): string {
  return data.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

// Link que abre o Google Calendar já com o evento preenchido (consulta de 30 minutos).
export function linkGoogleCalendar({ titulo, inicio, local }: DadosLinkCalendario): string {
  const fim = new Date(inicio.getTime() + DURACAO_MINUTOS * 60_000);
  const params = new URLSearchParams({
    text: titulo,
    dates: `${dataParaGoogle(inicio)}/${dataParaGoogle(fim)}`,
    location: local,
  });
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&${params.toString()}`;
}

import { partesEmSaoPaulo } from '../fuso';
import { linkGoogleCalendar } from './link-calendario';

export interface DadosTexto {
  paciente: string;
  medico: string;
  inicio: Date;
}

const CLINICA = 'Clínica Vida Plena';
const OPCOES = 'Responda:\n1 - Confirmar\n2 - Remarcar\n3 - Cancelar';

// "12/10/2026" e "09:00", sempre no horário de São Paulo.
function dataEHora(inicio: Date): { data: string; hora: string } {
  const partes = partesEmSaoPaulo(inicio);
  const [ano, mes, dia] = partes.data.split('-');
  const horas = String(Math.floor(partes.minutosDoDia / 60)).padStart(2, '0');
  const minutos = String(partes.minutosDoDia % 60).padStart(2, '0');
  return { data: `${dia}/${mes}/${ano}`, hora: `${horas}:${minutos}` };
}

// Mensagem 1: enviada quando a consulta é criada.
export function textoCriada({ paciente, medico, inicio }: DadosTexto): string {
  const { data, hora } = dataEHora(inicio);
  const link = linkGoogleCalendar({ titulo: `Consulta com ${medico}`, inicio, local: CLINICA });
  return [
    CLINICA,
    '',
    `Olá, ${paciente}! Sua consulta com ${medico} está marcada para ${data} às ${hora}.`,
    '',
    `Adicione ao seu calendário: ${link}`,
    '',
    'Cancelamentos devem ser feitos com no mínimo 24h de antecedência, sob pena de cobrança.',
  ].join('\n');
}

// Mensagem 2: pede a confirmação (72h antes).
export function textoConfirmacao({ paciente, medico, inicio }: DadosTexto): string {
  const { data, hora } = dataEHora(inicio);
  return [
    CLINICA,
    '',
    `Olá, ${paciente}! Você confirma sua consulta com ${medico} em ${data} às ${hora}?`,
    '',
    OPCOES,
  ].join('\n');
}

// Mensagem 3: lembrete (36h antes).
export function textoLembrete({ paciente, medico, inicio }: DadosTexto): string {
  const { data, hora } = dataEHora(inicio);
  return [
    CLINICA,
    '',
    `Olá, ${paciente}! Lembrete: sua consulta com ${medico} é em ${data} às ${hora}.`,
    '',
    OPCOES,
  ].join('\n');
}

// Mensagem 4: oferece uma vaga a quem está na lista de espera (`paciente` é o nome da pessoa da espera).
export function textoVaga({ paciente, medico, inicio }: DadosTexto): string {
  const { data, hora } = dataEHora(inicio);
  return [
    CLINICA,
    '',
    `Olá, ${paciente}! Surgiu uma vaga disponível em ${data} às ${hora} com ${medico}. Você quer ficar com ela?`,
    '',
    OPCOES,
  ].join('\n');
}

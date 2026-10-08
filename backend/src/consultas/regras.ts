import { partesEmSaoPaulo } from '../fuso';
import type { StatusConsulta } from '../models/consulta';
import type { HorarioGrade } from '../models/medico';

// Regras de agenda num lugar só (REG-01, AD-005): usadas pela criação de consulta e pela importação.

// Toda consulta ocupa um slot de 30 minutos.
export const DURACAO_SLOT_MINUTOS = 30;

// Consultas começam no minuto 0 ou 30, sem segundos.
// O fuso de São Paulo é de horas inteiras, então o minuto em UTC é o mesmo do horário local.
export function estaNoSlot(inicio: Date): boolean {
  return inicio.getUTCMinutes() % 30 === 0 && inicio.getUTCSeconds() === 0 && inicio.getUTCMilliseconds() === 0;
}

// "07:00" → 420
function minutosDaHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Dentro da grade: algum horário do dia da semana (em São Paulo) em que a consulta
// começa no início ou depois e termina até o fim.
export function dentroDaGrade(grade: HorarioGrade[], inicio: Date): boolean {
  const { diaSemana, minutosDoDia } = partesEmSaoPaulo(inicio);
  return grade.some(
    (horario) =>
      horario.dia === diaSemana &&
      minutosDoDia >= minutosDaHora(horario.inicio) &&
      minutosDoDia + DURACAO_SLOT_MINUTOS <= minutosDaHora(horario.fim),
  );
}

// Consulta cancelada não ocupa o horário.
export function ehAtiva(status: StatusConsulta): boolean {
  return status !== 'cancelada_paciente' && status !== 'cancelada_clinica';
}

export interface ConsultaNaAgenda {
  medicoId: string;
  pacienteId: string;
  inicio: Date;
}

// Horário ocupado: o médico ou o paciente já tem consulta ativa com o mesmo início.
// Como todas começam em :00 ou :30 e duram 30 minutos, "mesmo horário" é "mesmo início".
// O conflito do médico tem prioridade sobre o do paciente.
export function conflitoDeHorario(
  nova: ConsultaNaAgenda,
  existentes: (ConsultaNaAgenda & { status: StatusConsulta })[],
): 'medico' | 'paciente' | null {
  const noMesmoHorario = existentes.filter(
    (existente) => ehAtiva(existente.status) && existente.inicio.getTime() === nova.inicio.getTime(),
  );
  if (noMesmoHorario.some((existente) => existente.medicoId === nova.medicoId)) {
    return 'medico';
  }
  if (noMesmoHorario.some((existente) => existente.pacienteId === nova.pacienteId)) {
    return 'paciente';
  }
  return null;
}

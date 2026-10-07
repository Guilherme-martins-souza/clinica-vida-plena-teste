import type { ClientSession } from 'mongoose';
import { Medico } from '../models/medico';
import { Paciente } from '../models/paciente';

interface ReferenciasConsulta {
  medicoId: string;
  pacienteId: string;
}

// Confere se todos os médicos e pacientes das consultas existem.
// Faz uma busca por coleção (com $in), não uma por consulta.
export async function validarReferencias(consultas: ReferenciasConsulta[], session?: ClientSession): Promise<void> {
  if (consultas.length === 0) {
    return;
  }

  const medicoIds = [...new Set(consultas.map((consulta) => consulta.medicoId))];
  const pacienteIds = [...new Set(consultas.map((consulta) => consulta.pacienteId))];

  const medicos = await Medico.find({ _id: { $in: medicoIds } }, { _id: 1 })
    .session(session ?? null)
    .lean();
  const pacientes = await Paciente.find({ _id: { $in: pacienteIds } }, { _id: 1 })
    .session(session ?? null)
    .lean();

  const medicosExistentes = new Set(medicos.map((medico) => medico._id));
  const pacientesExistentes = new Set(pacientes.map((paciente) => paciente._id));

  const medicosFaltando = medicoIds.filter((id) => !medicosExistentes.has(id));
  const pacientesFaltando = pacienteIds.filter((id) => !pacientesExistentes.has(id));

  const problemas: string[] = [];
  if (medicosFaltando.length > 0) {
    problemas.push(`Médico inexistente: ${medicosFaltando.join(', ')}`);
  }
  if (pacientesFaltando.length > 0) {
    problemas.push(`Paciente inexistente: ${pacientesFaltando.join(', ')}`);
  }

  if (problemas.length > 0) {
    throw new Error(problemas.join('; '));
  }
}

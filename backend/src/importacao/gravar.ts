import mongoose from 'mongoose';
import { validarReferencias } from '../consultas/validar-referencias';
import { Consulta, type DadosConsulta } from '../models/consulta';
import { Medico, type DadosMedico } from '../models/medico';
import { Paciente, type DadosPaciente } from '../models/paciente';

export interface DadosParaGravar {
  medicos: DadosMedico[];
  pacientes: DadosPaciente[];
  consultas: DadosConsulta[];
}

// Troca médicos, pacientes e consultas pelos novos numa única transação (AD-001):
// se qualquer passo falhar, o Mongo desfaz tudo e o banco fica como estava.
export async function gravarDados(dados: DadosParaGravar): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Consulta.deleteMany({}, { session });
      await Paciente.deleteMany({}, { session });
      await Medico.deleteMany({}, { session });

      // insertMany valida cada documento pelo schema antes de gravar.
      await Medico.insertMany(dados.medicos, { session });
      await Paciente.insertMany(dados.pacientes, { session });
      await Consulta.insertMany(dados.consultas, { session });

      await validarReferencias(dados.consultas, session);
    });
  } finally {
    await session.endSession();
  }
}

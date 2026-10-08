import mongoose, { type HydratedDocument } from 'mongoose';
import { HttpError } from '../errors';
import { partesEmSaoPaulo } from '../fuso';
import { Consulta, type DadosConsulta, type TipoAtendimento } from '../models/consulta';
import { Medico } from '../models/medico';
import { Paciente } from '../models/paciente';
import { conflitoDeHorario, dentroDaGrade, estaNoSlot } from './regras';

export interface NovaConsulta {
  pacienteId: string;
  medicoId: string;
  tipoAtendimento: TipoAtendimento;
  inicio: Date;
}

export type ConsultaDoc = HydratedDocument<DadosConsulta>;

// 540 → "09:00"
function horaDoDia(minutosDoDia: number): string {
  const horas = String(Math.floor(minutosDoDia / 60)).padStart(2, '0');
  const minutos = String(minutosDoDia % 60).padStart(2, '0');
  return `${horas}:${minutos}`;
}

// Cria uma consulta nova (AGD-01). `agora` vem de fora (a rota passa new Date()), para os testes
// controlarem o relógio. Tudo roda numa transação: a checagem do horário e a gravação são uma coisa só.
export async function criarConsulta(dados: NovaConsulta, agora: Date): Promise<ConsultaDoc> {
  const session = await mongoose.startSession();
  try {
    let criada: ConsultaDoc | undefined;

    // Se duas transações escrevem no mesmo documento, o Mongo faz uma delas tentar de novo:
    // por isso a função pode rodar mais de uma vez, e só a última vale.
    await session.withTransaction(async () => {
      const medico = await Medico.findById(dados.medicoId).session(session);
      if (!medico) {
        throw new HttpError(404, 'MEDICO_NAO_ENCONTRADO', 'Médico não encontrado.');
      }
      const paciente = await Paciente.findById(dados.pacienteId).session(session);
      if (!paciente) {
        throw new HttpError(404, 'PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.');
      }

      if (!estaNoSlot(dados.inicio)) {
        throw new HttpError(422, 'FORA_DO_SLOT', 'A consulta precisa começar no minuto 00 ou 30.');
      }
      if (!dentroDaGrade(medico.grade, dados.inicio)) {
        throw new HttpError(422, 'FORA_DA_GRADE', `${medico.nome} não atende neste horário.`);
      }
      if (dados.inicio.getTime() <= agora.getTime()) {
        throw new HttpError(422, 'HORARIO_PASSADO', 'Escolha um horário que ainda não passou.');
      }

      // Trava (como o lockForUpdate do Laravel): escrever no médico e no paciente faz uma segunda
      // criação concorrente esperar e tentar de novo, já vendo a consulta gravada pela primeira.
      await Medico.updateOne({ _id: medico._id }, { $inc: { versaoAgenda: 1 } }, { session });
      await Paciente.updateOne({ _id: paciente._id }, { $inc: { versaoAgenda: 1 } }, { session });

      const noMesmoHorario = await Consulta.find({
        inicio: dados.inicio,
        $or: [{ medicoId: dados.medicoId }, { pacienteId: dados.pacienteId }],
      })
        .select('medicoId pacienteId inicio status')
        .session(session);

      const conflito = conflitoDeHorario(dados, noMesmoHorario);
      if (conflito) {
        const quem = conflito === 'medico' ? medico.nome : paciente.nome;
        const hora = horaDoDia(partesEmSaoPaulo(dados.inicio).minutosDoDia);
        throw new HttpError(409, 'HORARIO_OCUPADO', `${quem} já tem consulta às ${hora} neste dia.`);
      }

      const [consulta] = await Consulta.create(
        [
          {
            codigoLegado: null,
            pacienteId: dados.pacienteId,
            medicoId: dados.medicoId,
            tipoAtendimento: dados.tipoAtendimento,
            inicio: dados.inicio,
            marcadaEm: agora,
            canceladaEm: null,
            status: 'agendada',
          },
        ],
        { session },
      );
      criada = consulta;
    });

    if (!criada) {
      throw new Error('A transação terminou sem criar a consulta');
    }
    return criada;
  } finally {
    await session.endSession();
  }
}

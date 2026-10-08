import { HttpError } from '../errors';
import { Consulta, type StatusConsulta } from '../models/consulta';
import { enviarMensagem } from './enviar';

export type TipoAgendado = 'confirmacao' | 'lembrete';

// Memória desta execução do backend: reiniciar zera tudo.
export interface EstadoAgendador {
  enviados: Set<string>; // "idDaConsulta:tipo"
  porTipo: Record<TipoAgendado, number>;
}

export const LIMITE_POR_TIPO = 3;
const INTERVALO_MS = 60_000;
const HORA_MS = 3_600_000;

// Mensagem 2: até 72h antes, consulta agendada ou confirmada. Mensagem 3: até 36h antes, só agendada.
const REGRAS: Record<TipoAgendado, { horas: number; status: StatusConsulta[] }> = {
  confirmacao: { horas: 72, status: ['agendada', 'confirmada'] },
  lembrete: { horas: 36, status: ['agendada'] },
};

export function criarEstado(): EstadoAgendador {
  return { enviados: new Set(), porTipo: { confirmacao: 0, lembrete: 0 } };
}

// Uma rodada: `agora` vem de fora para os testes controlarem o relógio.
export async function rodarAgendador(agora: Date, estado: EstadoAgendador): Promise<void> {
  for (const tipo of ['confirmacao', 'lembrete'] as const) {
    const regra = REGRAS[tipo];
    const limite = new Date(agora.getTime() + regra.horas * HORA_MS);
    const consultas = await Consulta.find({
      status: { $in: regra.status },
      inicio: { $gt: agora, $lte: limite },
    })
      .select('_id')
      .sort({ inicio: 1 });

    for (const consulta of consultas) {
      if (estado.porTipo[tipo] >= LIMITE_POR_TIPO) {
        break;
      }
      const chave = `${consulta.id}:${tipo}`;
      if (estado.enviados.has(chave)) {
        continue;
      }
      try {
        await enviarMensagem(consulta.id, tipo);
        estado.enviados.add(chave);
        estado.porTipo[tipo] += 1;
      } catch (err) {
        // Sem telefone: pula em silêncio. Outras falhas: log, não conta e tenta na próxima rodada.
        if (!(err instanceof HttpError && err.code === 'SEM_TELEFONE')) {
          console.error(`Agendador: falha ao enviar ${tipo} da consulta ${consulta.id}:`, err);
        }
      }
    }
  }
}

// Roda a cada minuto; se a rodada anterior ainda não terminou, pula esta.
export function iniciarAgendador(rodada: typeof rodarAgendador = rodarAgendador): NodeJS.Timeout {
  const estado = criarEstado();
  let emAndamento = false;

  return setInterval(async () => {
    if (emAndamento) {
      return;
    }
    emAndamento = true;
    try {
      await rodada(new Date(), estado);
    } catch (err) {
      console.error('Agendador: rodada falhou:', err);
    } finally {
      emAndamento = false;
    }
  }, INTERVALO_MS);
}

import type { QueryFilter } from 'mongoose';
import { regexDeBusca } from '../busca';
import { diaSeguinte, inicioDoDia, partesEmSaoPaulo } from '../fuso';
import { Consulta, type DadosConsulta, type StatusConsulta, type TipoAtendimento } from '../models/consulta';
import { Medico } from '../models/medico';
import { Paciente } from '../models/paciente';
import { inicioDaPagina, type Pagina, type Paginacao } from '../paginacao';

// Abas da tela de agendamentos (AGD-03).
export const ABAS = ['hoje', 'proximas', 'aguardando', 'todas'] as const;
export type Aba = (typeof ABAS)[number];

export interface FiltroConsultas {
  aba: Aba;
  busca?: string; // trecho do nome do paciente
  status?: StatusConsulta;
  medicoId?: string;
  de?: string; // AAAA-MM-DD, só na aba "todas"
  ate?: string; // AAAA-MM-DD, inclusive, só na aba "todas"
}

export interface ConsultaResposta {
  id: string;
  codigo: string;
  paciente: { id: string; nome: string; telefone: string | null };
  primeiraConsulta: boolean;
  medico: { id: string; nome: string; especialidade: string };
  tipoAtendimento: TipoAtendimento;
  marcadaEm: Date | null;
  inicio: Date;
  status: StatusConsulta;
}

const PENDENTES: StatusConsulta[] = ['agendada', 'confirmada'];
const CANCELADAS: StatusConsulta[] = ['cancelada_paciente', 'cancelada_clinica'];

// Monta o filtro do Mongo: cada regra vira uma condição, e todas precisam valer ($and).
export async function montarFiltro(f: FiltroConsultas, agora: Date): Promise<QueryFilter<DadosConsulta>> {
  const condicoes: QueryFilter<DadosConsulta>[] = [];

  if (f.aba === 'hoje') {
    const hoje = partesEmSaoPaulo(agora).data;
    condicoes.push({ inicio: { $gte: inicioDoDia(hoje), $lt: inicioDoDia(diaSeguinte(hoje)) } });
  } else if (f.aba === 'proximas') {
    condicoes.push({ inicio: { $gte: agora }, status: { $in: PENDENTES } });
  } else if (f.aba === 'aguardando') {
    condicoes.push({ inicio: { $lt: agora }, status: { $in: PENDENTES } });
  } else {
    // O período só vale na aba "todas": as outras já são janelas de tempo.
    if (f.de) {
      condicoes.push({ inicio: { $gte: inicioDoDia(f.de) } });
    }
    if (f.ate) {
      condicoes.push({ inicio: { $lt: inicioDoDia(diaSeguinte(f.ate)) } });
    }
  }

  if (f.status) {
    condicoes.push({ status: f.status });
  }
  if (f.medicoId) {
    condicoes.push({ medicoId: f.medicoId });
  }
  if (f.busca) {
    const pacientes = await Paciente.find({ nome: regexDeBusca(f.busca) })
      .select('_id')
      .lean();
    condicoes.push({ pacienteId: { $in: pacientes.map((paciente) => paciente._id) } });
  }

  return condicoes.length > 0 ? { $and: condicoes } : {};
}

// Primeira consulta de cada paciente: a de menor início entre as não canceladas. Devolve os ids dessas consultas.
export async function primeirasConsultas(pacienteIds: string[]): Promise<Set<string>> {
  const primeiras = await Consulta.aggregate<{ _id: string; primeira: unknown }>([
    { $match: { pacienteId: { $in: pacienteIds }, status: { $nin: CANCELADAS } } },
    { $sort: { inicio: 1 } },
    { $group: { _id: '$pacienteId', primeira: { $first: '$_id' } } },
  ]);
  return new Set(primeiras.map((item) => String(item.primeira)));
}

export async function listarConsultas(
  f: FiltroConsultas,
  paginacao: Paginacao,
  agora: Date,
): Promise<Pagina<ConsultaResposta>> {
  const filtro = await montarFiltro(f, agora);
  // Hoje e próximas: o que está mais perto primeiro. Aguardando e todas: o mais recente primeiro.
  const ordem = f.aba === 'hoje' || f.aba === 'proximas' ? 1 : -1;

  const [consultas, total] = await Promise.all([
    Consulta.find(filtro)
      .sort({ inicio: ordem, _id: ordem })
      .skip(inicioDaPagina(paginacao))
      .limit(paginacao.porPagina)
      .lean(),
    Consulta.countDocuments(filtro),
  ]);

  // Pacientes, médicos e primeiras consultas só da página, em três buscas ($in).
  const pacienteIds = [...new Set(consultas.map((consulta) => consulta.pacienteId))];
  const medicoIds = [...new Set(consultas.map((consulta) => consulta.medicoId))];
  const [pacientes, medicos, primeiras] = await Promise.all([
    Paciente.find({ _id: { $in: pacienteIds } }).lean(),
    Medico.find({ _id: { $in: medicoIds } }).lean(),
    primeirasConsultas(pacienteIds),
  ]);
  const pacientePorId = new Map(pacientes.map((paciente) => [paciente._id, paciente]));
  const medicoPorId = new Map(medicos.map((medico) => [medico._id, medico]));

  const itens = consultas.map((consulta): ConsultaResposta => {
    const id = String(consulta._id);
    const paciente = pacientePorId.get(consulta.pacienteId);
    const medico = medicoPorId.get(consulta.medicoId);
    return {
      id,
      // Consultas criadas pela tela não têm código legado: mostra o fim do id.
      codigo: consulta.codigoLegado ?? id.slice(-6),
      paciente: { id: consulta.pacienteId, nome: paciente?.nome ?? '', telefone: paciente?.telefone ?? null },
      primeiraConsulta: primeiras.has(id),
      medico: { id: consulta.medicoId, nome: medico?.nome ?? '', especialidade: medico?.especialidade ?? '' },
      tipoAtendimento: consulta.tipoAtendimento,
      marcadaEm: consulta.marcadaEm,
      inicio: consulta.inicio,
      status: consulta.status,
    };
  });

  return { itens, total, ...paginacao };
}

// Total de cada aba com os mesmos filtros (o período continua valendo só na aba "todas").
export async function contarAbas(f: Omit<FiltroConsultas, 'aba'>, agora: Date): Promise<Record<Aba, number>> {
  const totais = await Promise.all(
    ABAS.map(async (aba) => Consulta.countDocuments(await montarFiltro({ ...f, aba }, agora))),
  );
  return { hoje: totais[0], proximas: totais[1], aguardando: totais[2], todas: totais[3] };
}

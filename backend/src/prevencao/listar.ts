import { type ConsultaResposta, primeirasConsultas } from '../consultas/listar-consultas';
import { diaSeguinte, inicioDoDia, partesEmSaoPaulo } from '../fuso';
import { ehFaltoso, historicoDe, type Historico } from '../historico/historico';
import { Consulta } from '../models/consulta';
import { Medico } from '../models/medico';
import { Paciente } from '../models/paciente';
import { inicioDaPagina, type Pagina, type Paginacao } from '../paginacao';
import { calcularRisco, type FatorRisco, type NivelRisco } from '../risco/calcular-risco';

// A aba olha de agora até o fim do 14º dia depois de hoje (PAINEL-01).
const DIAS_A_FRENTE = 14;

export type NivelPrevencao = Exclude<NivelRisco, 'baixo'>;

export interface FiltroPrevencao {
  nivel?: NivelPrevencao;
}

export interface ConsultaPrevencao extends ConsultaResposta {
  risco: { pontos: number; nivel: NivelPrevencao; fatores: FatorRisco[] };
}

const SEM_HISTORICO: Historico = { faltas: 0, atendimentos: 0, ultimos5: [] };

// Instante em que a janela termina: 00:00 do dia seguinte ao 14º dia (horário de São Paulo).
function fimDaJanela(agora: Date): Date {
  let dia = partesEmSaoPaulo(agora).data;
  for (let i = 0; i < DIAS_A_FRENTE; i++) {
    dia = diaSeguinte(dia);
  }
  return inicioDoDia(diaSeguinte(dia));
}

// Consultas `agendada` ou `confirmada` dos próximos 14 dias com risco média ou maior.
// O risco depende do histórico do paciente, então é calculado aqui e a página é cortada em memória.
export async function listarPrevencao(
  filtro: FiltroPrevencao,
  paginacao: Paginacao,
  agora: Date,
): Promise<Pagina<ConsultaPrevencao>> {
  const consultas = await Consulta.find({
    status: { $in: ['agendada', 'confirmada'] },
    inicio: { $gte: agora, $lt: fimDaJanela(agora) },
  })
    .sort({ inicio: 1, _id: 1 })
    .lean();

  const pacienteIds = [...new Set(consultas.map((consulta) => consulta.pacienteId))];
  const medicoIds = [...new Set(consultas.map((consulta) => consulta.medicoId))];
  const [pacientes, medicos, primeiras, historicos] = await Promise.all([
    Paciente.find({ _id: { $in: pacienteIds } }).lean(),
    Medico.find({ _id: { $in: medicoIds } }).lean(),
    primeirasConsultas(pacienteIds),
    historicoDe(pacienteIds, agora),
  ]);
  const pacientePorId = new Map(pacientes.map((paciente) => [paciente._id, paciente]));
  const medicoPorId = new Map(medicos.map((medico) => [medico._id, medico]));

  const itens: ConsultaPrevencao[] = [];
  for (const consulta of consultas) {
    const id = String(consulta._id);
    const historico = historicos.get(consulta.pacienteId) ?? SEM_HISTORICO;
    const risco = calcularRisco({
      inicio: consulta.inicio,
      agora,
      status: consulta.status,
      tipoAtendimento: consulta.tipoAtendimento,
      primeiraConsulta: primeiras.has(id),
      faltas: historico.faltas,
      atendimentos: historico.atendimentos,
    });
    // Risco baixo não aparece; com filtro, só o nível pedido.
    if (risco.nivel === 'baixo' || (filtro.nivel && risco.nivel !== filtro.nivel)) {
      continue;
    }

    const paciente = pacientePorId.get(consulta.pacienteId);
    const medico = medicoPorId.get(consulta.medicoId);
    itens.push({
      id,
      codigo: consulta.codigoLegado ?? id.slice(-6),
      paciente: { id: consulta.pacienteId, nome: paciente?.nome ?? '', telefone: paciente?.telefone ?? null },
      primeiraConsulta: primeiras.has(id),
      faltoso: ehFaltoso(historico),
      medico: { id: consulta.medicoId, nome: medico?.nome ?? '', especialidade: medico?.especialidade ?? '' },
      tipoAtendimento: consulta.tipoAtendimento,
      marcadaEm: consulta.marcadaEm,
      inicio: consulta.inicio,
      status: consulta.status,
      consideradoFalta: consulta.consideradoFalta,
      risco: { pontos: risco.pontos, nivel: risco.nivel, fatores: risco.fatores },
    });
  }

  const inicio = inicioDaPagina(paginacao);
  return { itens: itens.slice(inicio, inicio + paginacao.porPagina), total: itens.length, ...paginacao };
}

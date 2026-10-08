import { getJson, isJsonObject, type JsonObject } from './http'
import { toDataIso } from '../lib/periodo'
import type { ContagemFaltas, Indicadores, Periodo, TipoAtendimento, Turno } from './types'

// Buscas usadas pela tela de Indicadores (GET /api/indicadores).
// Cada função confere o formato do que a API devolveu antes de entregar para a tela.

/** Lança um erro claro quando a API devolve algo fora do formato esperado. */
function formatoInvalido(): never {
  throw new Error('A API devolveu os indicadores num formato inesperado.')
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : formatoInvalido()
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : formatoInvalido()
}

function toObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : formatoInvalido()
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : formatoInvalido()
}

function toContagem(value: unknown): ContagemFaltas {
  const c = toObject(value)
  return { faltas: toNumber(c.faltas), concluidas: toNumber(c.concluidas) }
}

function toTurno(value: unknown): Turno {
  return value === 'Manhã' || value === 'Tarde' ? value : formatoInvalido()
}

function toTipo(value: unknown): TipoAtendimento {
  return value === 'convenio' || value === 'particular' ? value : formatoInvalido()
}

function toIndicadores(corpo: unknown): Indicadores {
  const dados = toObject(corpo)
  const periodo = toObject(dados.periodo)
  const totais = toObject(dados.totais)
  const anterior = dados.taxaFaltaPeriodoAnterior

  return {
    periodo: { de: toText(periodo.de), ate: toText(periodo.ate) },
    totais: {
      realizadas: toNumber(totais.realizadas),
      faltas: toNumber(totais.faltas),
      canceladasPaciente: toNumber(totais.canceladasPaciente),
      canceladasClinica: toNumber(totais.canceladasClinica),
      agendadas: toNumber(totais.agendadas),
      confirmadas: toNumber(totais.confirmadas),
    },
    taxaFaltaPeriodoAnterior: anterior === null ? null : toNumber(anterior),
    porMedico: toArray(dados.porMedico).map((item) => {
      const medico = toObject(toObject(item).medico)
      return {
        ...toContagem(item),
        medico: { id: toText(medico.id), nome: toText(medico.nome), especialidade: toText(medico.especialidade) },
      }
    }),
    diaTurno: toArray(dados.diaTurno).map((item) => {
      const linha = toObject(item)
      return { turno: toTurno(linha.turno), dias: toArray(linha.dias).map(toContagem) }
    }),
    porTipo: toArray(dados.porTipo).map((item) => ({ ...toContagem(item), tipo: toTipo(toObject(item).tipo) })),
    porPrimeiraConsulta: toArray(dados.porPrimeiraConsulta).map((item) => ({
      ...toContagem(item),
      primeiraConsulta: toObject(item).primeiraConsulta === true,
    })),
    porAntecedencia: toArray(dados.porAntecedencia).map((item) => ({
      ...toContagem(item),
      faixa: toText(toObject(item).faixa),
    })),
  }
}

/** Indicadores do período (dias de início da consulta, inclusive). */
export async function fetchIndicadores(periodo: Periodo): Promise<Indicadores> {
  const params = new URLSearchParams({ de: toDataIso(periodo.de), ate: toDataIso(periodo.ate) })
  return toIndicadores(await getJson(`/api/indicadores?${params}`))
}

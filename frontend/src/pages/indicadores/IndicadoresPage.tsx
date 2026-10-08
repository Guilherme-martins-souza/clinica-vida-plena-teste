import { Alert, Card, Grid, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { fetchIndicadores } from '../../api/indicadores'
import type { ContagemFaltas, Indicadores } from '../../api/types'
import { BarList, type BarListRow } from '../../components/BarList'
import { CardHeader } from '../../components/CardHeader'
import { HeatGrid, HeatGridLegend } from '../../components/HeatGrid'
import { PageHeader } from '../../components/PageHeader'
import { PeriodFilter } from '../../components/PeriodFilter'
import { lerPeriodoDaUrl, toDataIso } from '../../lib/periodo'
import { StatCard } from '../../components/StatCard'
import { STATUS_LABELS } from '../../lib/status'
import { formatInteger, formatPercent, formatPointsDelta, rate } from '../../lib/format'

/** Escala única de todas as barras da tela, para que sejam comparáveis entre si. */
const ESCALA_MAX = 40

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
const DIAS_EXTENSO = ['segunda', 'terça', 'quarta', 'quinta', 'sexta']

// Os status que finalizam uma consulta (as que ainda estão agendada ou confirmada não foram finalizadas).
const FINALIZACOES = [
  STATUS_LABELS.realizada,
  STATUS_LABELS.falta,
  STATUS_LABELS.cancelada_paciente,
  STATUS_LABELS.cancelada_clinica,
]

/** Taxa de falta em %; null quando o recorte não tem consulta concluída (a tela mostra "—"). */
function taxaOuNull(c: ContagemFaltas): number | null {
  return c.concluidas === 0 ? null : rate(c.faltas, c.concluidas)
}

/** Monta uma linha de barra a partir das contagens de faltas. */
function toBarRow(label: string, c: ContagemFaltas, sublabel?: string): BarListRow {
  const taxa = rate(c.faltas, c.concluidas)
  const count = `${formatInteger(c.faltas)} de ${formatInteger(c.concluidas)}`
  if (c.concluidas === 0) {
    return { label, sublabel, value: 0, semDados: true, count, description: `${label}: sem consultas concluídas` }
  }
  return {
    label,
    sublabel,
    value: taxa,
    count,
    description: `${label}: ${formatPercent(taxa)} — ${formatInteger(c.faltas)} faltas em ${formatInteger(c.concluidas)} consultas concluídas`,
  }
}

const byValueDesc = (a: BarListRow, b: BarListRow) => b.value - a.value

export function IndicadoresPage() {
  // O período fica na URL (?periodo=3m ou ?periodo=personalizado&de=…&ate=…) para a tela poder ser compartilhada.
  const [searchParams, setSearchParams] = useSearchParams()
  const { atalho, periodo } = lerPeriodoDaUrl(searchParams)

  const query = useQuery({
    queryKey: ['indicadores', toDataIso(periodo.de), toDataIso(periodo.ate)],
    queryFn: () => fetchIndicadores(periodo),
  })

  return (
    <>
      <PageHeader
        title="Indicadores"
        description="Faltas e comparecimento no período selecionado."
        actions={
          <PeriodFilter
            value={atalho}
            periodo={periodo}
            onChange={(v) => setSearchParams({ periodo: v })}
            onChangeIntervalo={(de, ate) => setSearchParams({ periodo: 'personalizado', de, ate })}
          />
        }
      />

      {query.isPending && <IndicadoresSkeleton />}
      {query.isError && (
        <Alert color="red" title="Não foi possível carregar os indicadores">
          {query.error.message}
        </Alert>
      )}
      {query.isSuccess && <IndicadoresConteudo dados={query.data} />}
    </>
  )
}

function IndicadoresConteudo({ dados }: { dados: Indicadores }) {
  const { totais } = dados
  const concluidas = totais.realizadas + totais.faltas
  const taxaGeral = rate(totais.faltas, concluidas)
  const anterior = dados.taxaFaltaPeriodoAnterior
  // Sem concluídas no período não há taxa; sem concluídas no período anterior não há com o que comparar.
  const variacao = concluidas > 0 && anterior !== null ? taxaGeral - anterior : null
  let dicaDaTaxa = 'vs. período anterior'
  if (concluidas === 0) dicaDaTaxa = 'sem consultas concluídas no período'
  else if (anterior === null) dicaDaTaxa = 'sem dados do período anterior'

  const porMedico = dados.porMedico.map((m) => toBarRow(m.medico.nome, m, m.medico.especialidade)).sort(byValueDesc)
  const porTipo = dados.porTipo
    .map((t) => toBarRow(t.tipo === 'convenio' ? 'Convênio' : 'Particular', t))
    .sort(byValueDesc)
  const porPrimeira = dados.porPrimeiraConsulta
    .map((p) => toBarRow(p.primeiraConsulta ? 'Primeira consulta' : 'Retorno', p))
    .sort(byValueDesc)
  // Antecedência tem ordem própria (da menor para a maior), por isso não ordena.
  const porAntecedencia = dados.porAntecedencia.map((a) => toBarRow(a.faixa, a))

  const diaTurno = dados.diaTurno.map((linha) => ({ label: linha.turno, values: linha.dias.map(taxaOuNull) }))

  // Célula com a maior taxa, para a frase de leitura da grade (ignora as células sem dados).
  let pior: { turno: string; dia: number; taxa: number } | null = null
  for (const linha of diaTurno) {
    for (const [dia, taxa] of linha.values.entries()) {
      if (taxa !== null && (pior === null || taxa > pior.taxa)) pior = { turno: linha.label, dia, taxa }
    }
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <StatCard
          label="Taxa de falta"
          value={concluidas > 0 ? formatPercent(taxaGeral) : '—'}
          hint={dicaDaTaxa}
          delta={
            variacao === null
              ? undefined
              : {
                  text: formatPointsDelta(variacao),
                  tone: variacao <= 0 ? 'good' : 'bad',
                  direction: variacao <= 0 ? 'down' : 'up',
                }
          }
        />
        <StatCard
          label="Consultas concluídas"
          value={formatInteger(concluidas)}
          hint={`${formatInteger(totais.realizadas)} realizadas · ${formatInteger(totais.faltas)} faltas`}
        />
        <StatCard
          label="Cancelamentos"
          value={formatInteger(totais.canceladasPaciente + totais.canceladasClinica)}
          hint={`${formatInteger(totais.canceladasPaciente)} pelo paciente · ${formatInteger(totais.canceladasClinica)} pela clínica`}
        />
        <StatCard
          label="Consultas agendadas"
          value={formatInteger(totais.agendadas + totais.confirmadas)}
          hint={`${formatInteger(totais.agendadas)} agendadas · ${formatInteger(totais.confirmadas)} confirmadas`}
          info={
            <>
              Consultas do período que ainda não foram finalizadas. Para finalizar, a recepção registra o status:{' '}
              {FINALIZACOES.join(', ')}.
            </>
          }
        />
      </SimpleGrid>

      {/* Barras por médico ao lado da grade (cerca de 3/5 e 2/5); empilham abaixo de 1080px. */}
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card component="section" h="100%">
            <CardHeader title="Taxa de falta por médico" note="faltas ÷ consultas concluídas" />
            <BarList
              rows={porMedico}
              max={ESCALA_MAX}
              // Sem consultas concluídas não há média para marcar.
              reference={concluidas > 0 ? { value: taxaGeral, label: 'Média da clínica' } : undefined}
            />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card component="section" h="100%">
            <CardHeader title="Dia da semana e turno" note="taxa de falta" />
            <HeatGrid
              label="Taxa de falta por dia da semana e turno"
              columns={DIAS}
              rows={diaTurno}
              format={(v) => `${Math.round(v)}%`}
              describe={(turno, dia, v) => `${dia}, ${turno.toLowerCase()}: ${formatPercent(v)} de falta`}
            />
            <HeatGridLegend
              insight={
                pior === null
                  ? 'Sem consultas concluídas no período'
                  : `Pior horário: ${DIAS_EXTENSO[pior.dia]} de ${pior.turno.toLowerCase()}`
              }
            />
          </Card>
        </Grid.Col>
      </Grid>

      <Stack gap="sm">
        <Group justify="space-between" align="baseline" gap="xs">
          <Title order={2} fz="lg" lh="1.5rem">
            O que ajuda a explicar as faltas
          </Title>
          <Text fz="xs" c="dimmed">
            taxa de falta por recorte, mesma escala de 0 a {ESCALA_MAX}%
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <Card component="section">
            <CardHeader title="Tipo de atendimento" order={3} />
            <BarList rows={porTipo} max={ESCALA_MAX} compact />
          </Card>
          <Card component="section">
            <CardHeader title="Paciente novo ou retorno" order={3} />
            <BarList rows={porPrimeira} max={ESCALA_MAX} compact />
          </Card>
          <Card component="section">
            <CardHeader title="Antecedência da marcação" order={3} />
            <BarList rows={porAntecedencia} max={ESCALA_MAX} compact />
          </Card>
        </SimpleGrid>
      </Stack>
    </>
  )
}

function IndicadoresSkeleton() {
  return (
    <>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} h="7.5rem" radius="lg" />
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Skeleton h="22rem" radius="lg" />
        <Skeleton h="22rem" radius="lg" />
      </SimpleGrid>
    </>
  )
}

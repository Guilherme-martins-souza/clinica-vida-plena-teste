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
import { isPeriodoAtalho, resolvePeriodo, type PeriodoAtalho } from '../../lib/periodo'
import { StatCard } from '../../components/StatCard'
import { formatInteger, formatPercent, formatPointsDelta, rate } from '../../lib/format'
import { AgendamentosTable } from './AgendamentosTable'

/** Escala única de todas as barras da tela, para que sejam comparáveis entre si. */
const ESCALA_MAX = 40

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
const DIAS_EXTENSO = ['segunda', 'terça', 'quarta', 'quinta', 'sexta']

/** Monta uma linha de barra a partir das contagens de faltas. */
function toBarRow(label: string, c: ContagemFaltas, sublabel?: string): BarListRow {
  const taxa = rate(c.faltas, c.concluidas)
  return {
    label,
    sublabel,
    value: taxa,
    count: `${formatInteger(c.faltas)} de ${formatInteger(c.concluidas)}`,
    description: `${label}: ${formatPercent(taxa)} — ${formatInteger(c.faltas)} faltas em ${formatInteger(c.concluidas)} consultas concluídas`,
  }
}

const byValueDesc = (a: BarListRow, b: BarListRow) => b.value - a.value

export function IndicadoresPage() {
  // O atalho de período fica na URL (?periodo=3m) para a tela poder ser compartilhada.
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('periodo')
  const atalho: PeriodoAtalho = isPeriodoAtalho(param) ? param : '12m'
  const periodo = resolvePeriodo(atalho)

  const query = useQuery({
    queryKey: ['indicadores', atalho],
    queryFn: () => fetchIndicadores(periodo),
  })

  return (
    <>
      <PageHeader
        title="Indicadores"
        description="Faltas e comparecimento no período selecionado."
        actions={<PeriodFilter value={atalho} periodo={periodo} onChange={(v) => setSearchParams({ periodo: v })} />}
      />

      {query.isPending && <IndicadoresSkeleton />}
      {query.isError && (
        <Alert color="red" title="Não foi possível carregar os indicadores">
          {query.error.message}
        </Alert>
      )}
      {query.isSuccess && <IndicadoresConteudo dados={query.data} />}

      <AgendamentosTable periodo={periodo} />
    </>
  )
}

function IndicadoresConteudo({ dados }: { dados: Indicadores }) {
  const { totais } = dados
  const concluidas = totais.realizadas + totais.faltas
  const taxaGeral = rate(totais.faltas, concluidas)
  const variacao = taxaGeral - dados.taxaFaltaPeriodoAnterior

  const porMedico = dados.porMedico.map((m) => toBarRow(m.medico.nome, m, m.medico.especialidade)).sort(byValueDesc)
  const porTipo = dados.porTipo
    .map((t) => toBarRow(t.tipo === 'convenio' ? 'Convênio' : 'Particular', t))
    .sort(byValueDesc)
  const porPrimeira = dados.porPrimeiraConsulta
    .map((p) => toBarRow(p.primeiraConsulta ? 'Primeira consulta' : 'Retorno', p))
    .sort(byValueDesc)
  // Antecedência tem ordem própria (da menor para a maior), por isso não ordena.
  const porAntecedencia = dados.porAntecedencia.map((a) => toBarRow(a.faixa, a))

  // Célula com a maior taxa, para a frase de leitura da grade.
  let pior = { turno: dados.diaTurno[0].turno, dia: 0, taxa: -1 }
  for (const linha of dados.diaTurno) {
    linha.taxas.forEach((taxa, dia) => {
      if (taxa > pior.taxa) pior = { turno: linha.turno, dia, taxa }
    })
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <StatCard
          label="Taxa de falta"
          value={formatPercent(taxaGeral)}
          hint="vs. período anterior"
          delta={{
            text: formatPointsDelta(variacao),
            tone: variacao <= 0 ? 'good' : 'bad',
            direction: variacao <= 0 ? 'down' : 'up',
          }}
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
          label="Próximas consultas"
          value={formatInteger(totais.proximas)}
          hint={`${formatInteger(totais.proximasSemConfirmacao)} ainda sem confirmação`}
        />
      </SimpleGrid>

      {/* Barras por médico ao lado da grade (cerca de 3/5 e 2/5); empilham abaixo de 1080px. */}
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card component="section" h="100%">
            <CardHeader title="Taxa de falta por médico" note="faltas ÷ consultas concluídas" />
            <BarList rows={porMedico} max={ESCALA_MAX} reference={{ value: taxaGeral, label: 'Média da clínica' }} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card component="section" h="100%">
            <CardHeader title="Dia da semana e turno" note="taxa de falta" />
            <HeatGrid
              label="Taxa de falta por dia da semana e turno"
              columns={DIAS}
              rows={dados.diaTurno.map((l) => ({ label: l.turno, values: l.taxas }))}
              format={(v) => `${v}%`}
              describe={(turno, dia, v) => `${dia}, ${turno.toLowerCase()}: ${v}% de falta`}
            />
            <HeatGridLegend insight={`Pior horário: ${DIAS_EXTENSO[pior.dia]} de ${pior.turno.toLowerCase()}`} />
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

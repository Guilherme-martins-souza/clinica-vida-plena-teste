import { Alert, Anchor, Button, Card, Group, SimpleGrid, Skeleton, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { fetchImportacao, type ImportacaoDetalhe, type TotaisImportacao } from '../../api/importacoes'
import { BarList, type BarListRow } from '../../components/BarList'
import { CardHeader } from '../../components/CardHeader'
import { PageHeader } from '../../components/PageHeader'
import { StatCard } from '../../components/StatCard'
import { formatDateTime, formatInteger, formatPercent, rate } from '../../lib/format'
import { CORRECAO_LABELS, MOTIVO_LABELS, ORIGEM_LABELS } from '../../lib/importacao'
import { DescartesTable } from './DescartesTable'
import classes from './ImportacaoDetalhePage.module.css'
import { SituacaoBadge } from './SituacaoBadge'

/**
 * Linhas da BarList a partir das contagens { chave: número }, da maior para a menor.
 * A escala de cada cartão vai até a maior contagem dele; ao lado da barra fica a contagem e a parte do total.
 */
function toBarRows(contagens: Partial<Record<string, number>>, labels: Record<string, string>, total: number) {
  const rows: BarListRow[] = []
  for (const [chave, n] of Object.entries(contagens)) {
    if (!n) continue
    const label = labels[chave] ?? chave
    rows.push({
      label,
      value: n,
      count: formatPercent(rate(n, total)),
      description: `${label}: ${formatInteger(n)} linhas`,
    })
  }
  return rows.sort((a, b) => b.value - a.value)
}

function maiorValor(rows: BarListRow[]): number {
  return Math.max(1, ...rows.map((r) => r.value))
}

export function ImportacaoDetalhePage() {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: ['importacoes', id],
    queryFn: () => fetchImportacao(id),
    retry: false, // id inexistente não passa a existir tentando de novo
  })

  const titulo = query.isSuccess ? formatDateTime(query.data.iniciadaEm) : 'Importação'

  return (
    <>
      <nav aria-label="Trilha" className={classes.trilha}>
        <Anchor component={Link} to="/importacoes" fz="sm">
          Importações
        </Anchor>
        <span aria-hidden="true">/</span>
        <Text span fz="sm" fw={600} c="var(--ink)" aria-current="page">
          {titulo}
        </Text>
      </nav>

      <PageHeader
        title={query.isSuccess ? `Importação de ${titulo}` : 'Importação'}
        description={query.isSuccess ? descricao(query.data) : undefined}
        actions={
          <Button component={Link} to="/importacoes" leftSection={<ArrowLeft size={16} strokeWidth={1.75} />}>
            Voltar para Importações
          </Button>
        }
      />

      {query.isPending && <DetalheSkeleton />}
      {query.isError && (
        <Alert color="red" title="Não foi possível carregar a importação">
          {query.error.message}
        </Alert>
      )}
      {query.isSuccess && <DetalheConteudo importacao={query.data} />}
    </>
  )
}

function descricao(importacao: ImportacaoDetalhe): string {
  const origem = `Importação ${ORIGEM_LABELS[importacao.origem].toLowerCase()}`
  if (!importacao.dataReferencia) return `${origem}.`
  return `${origem}. Consultas até ${formatDateTime(importacao.dataReferencia)} contam como passadas.`
}

function DetalheConteudo({ importacao }: { importacao: ImportacaoDetalhe }) {
  if (importacao.situacao === 'falhou') {
    return (
      <Alert color="red" title="A importação falhou">
        <Group gap="xs" mb="xs">
          <SituacaoBadge situacao="falhou" />
        </Group>
        {importacao.erro ?? 'Sem mensagem de erro.'} Nada desta importação foi gravado nas consultas.
      </Alert>
    )
  }

  if (!importacao.totais) {
    return (
      <Group gap="sm">
        <SituacaoBadge situacao={importacao.situacao} />
        <Text c="dimmed">Os números aparecem quando a importação terminar.</Text>
      </Group>
    )
  }

  return <DetalheConcluida importacao={importacao} totais={importacao.totais} />
}

function DetalheConcluida({ importacao, totais }: { importacao: ImportacaoDetalhe; totais: TotaisImportacao }) {
  const motivos = toBarRows(importacao.descartesPorMotivo, MOTIVO_LABELS, totais.descartadas)
  const correcoes = toBarRows(importacao.correcoesPorTipo, CORRECAO_LABELS, totais.importadas)
  const slots = importacao.slotsDuplos.length

  return (
    <>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <StatCard label="Linhas lidas" value={formatInteger(totais.lidas)} hint="do agendamentos.csv" />
        <StatCard
          label="Importadas"
          value={formatInteger(totais.importadas)}
          hint={`${formatPercent(rate(totais.importadas, totais.lidas))} das lidas`}
        />
        <StatCard
          label="Corrigidas"
          value={formatInteger(totais.corrigidas)}
          hint="importadas com ao menos uma correção"
        />
        <StatCard
          label="Descartadas"
          value={formatInteger(totais.descartadas)}
          hint={`${formatPercent(rate(totais.descartadas, totais.lidas))} das lidas`}
        />
      </SimpleGrid>

      {slots > 0 && (
        <Card component="section">
          <div className={classes.aviso}>
            <TriangleAlert size={20} strokeWidth={1.75} className={classes.avisoIcone} aria-hidden="true" />
            <Text>
              {formatInteger(slots)} {slots === 1 ? 'horário ficou' : 'horários ficaram'} com duas consultas ativas no
              mesmo médico. As duas foram importadas; confira na agenda qual delas deve ficar.
            </Text>
          </div>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card component="section">
          <CardHeader title="Descartes por motivo" note="% das descartadas" />
          {motivos.length > 0 ? (
            <BarList rows={motivos} max={maiorValor(motivos)} formatValue={formatInteger} />
          ) : (
            <Text c="dimmed">Nenhuma linha foi descartada.</Text>
          )}
        </Card>
        <Card component="section">
          <CardHeader title="Correções por tipo" note="% das importadas; uma linha pode ter várias" />
          {correcoes.length > 0 ? (
            <BarList rows={correcoes} max={maiorValor(correcoes)} formatValue={formatInteger} />
          ) : (
            <Text c="dimmed">Nenhuma linha precisou de correção.</Text>
          )}
        </Card>
      </SimpleGrid>

      <DescartesTable importacaoId={importacao.id} descartesPorMotivo={importacao.descartesPorMotivo} />
    </>
  )
}

function DetalheSkeleton() {
  return (
    <>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} h="7.5rem" radius="lg" />
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Skeleton h="20rem" radius="lg" />
        <Skeleton h="20rem" radius="lg" />
      </SimpleGrid>
    </>
  )
}

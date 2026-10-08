import { Alert, Anchor, Button, Card, EmptyState, Skeleton, Table } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Eye, FileSpreadsheet } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { fetchImportacoes, type ImportacaoResumo } from '../../api/importacoes'
import { AvisoCard } from '../../components/AvisoCard'
import { Paginacao } from '../../components/Paginacao'
import { PageHeader } from '../../components/PageHeader'
import { formatDateTime, formatInteger } from '../../lib/format'
import { ORIGEM_LABELS } from '../../lib/importacao'
import tableClasses from '../indicadores/AgendamentosTable.module.css'
import classes from './ImportacoesPage.module.css'
import { SituacaoBadge } from './SituacaoBadge'

/** Número da coluna de totais; "—" quando a importação não chegou a contar (em andamento ou falhou). */
function total(valor: number | undefined): string {
  return valor === undefined ? '—' : formatInteger(valor)
}

const POR_PAGINA = 10

export function ImportacoesPage() {
  const [pagina, setPagina] = useState(1)
  const query = useQuery({
    queryKey: ['importacoes', pagina],
    queryFn: () => fetchImportacoes(pagina, POR_PAGINA),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })

  return (
    <>
      <PageHeader
        title="Importações"
        description="Cargas do arquivo de agendamentos e o que aconteceu com cada linha."
      />

      {query.isPending && <Skeleton h="15rem" radius="lg" />}
      {query.isError && (
        <Alert color="red" title="Não foi possível carregar as importações">
          {query.error.message}
        </Alert>
      )}
      {query.isSuccess && query.data.total === 0 && (
        <EmptyState
          mx="auto"
          my="xl"
          maw="26.25rem"
          icon={<FileSpreadsheet size={28} strokeWidth={1.75} />}
          title="Nenhuma importação ainda"
          description="A importação dos arquivos de data/ roda sozinha ao subir o sistema. Quando terminar, ela aparece aqui."
        />
      )}
      {query.isSuccess && query.data.total > 0 && (
        <>
          <AvisoCard tom="info">Clique em uma importação para visualizar detalhes.</AvisoCard>
          <ImportacoesTabela
            importacoes={query.data.itens}
            pagina={pagina}
            totalImportacoes={query.data.total}
            onChangePagina={setPagina}
          />
        </>
      )}
    </>
  )
}

// O clique no link ou no botão já navega; sem isto o clique sobe para a linha e navega de novo,
// deixando duas entradas iguais no histórico do navegador.
function naoSobeParaALinha(event: MouseEvent) {
  event.stopPropagation()
}

type ImportacoesTabelaProps = {
  importacoes: ImportacaoResumo[]
  pagina: number
  totalImportacoes: number
  onChangePagina: (pagina: number) => void
}

function ImportacoesTabela({ importacoes, pagina, totalImportacoes, onChangePagina }: ImportacoesTabelaProps) {
  const navigate = useNavigate()

  return (
    <Card component="section" padding={0} className={tableClasses.card}>
      <Table.ScrollContainer minWidth="58rem" type="native">
        <Table
          highlightOnHover
          tabularNums
          verticalSpacing="0.625rem"
          horizontalSpacing="sm"
          className={tableClasses.table}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data e hora</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th>Situação</Table.Th>
              <Table.Th className={classes.numero}>Lidas</Table.Th>
              <Table.Th className={classes.numero}>Importadas</Table.Th>
              <Table.Th className={classes.numero}>Corrigidas</Table.Th>
              <Table.Th className={classes.numero}>Descartadas</Table.Th>
              <Table.Th className={classes.acoes}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {importacoes.map((i) => (
              <Table.Tr key={i.id} className={classes.row} onClick={() => navigate(`/importacoes/${i.id}`)}>
                <Table.Td>
                  <Anchor component={Link} to={`/importacoes/${i.id}`} fw={500} onClick={naoSobeParaALinha}>
                    {formatDateTime(i.iniciadaEm)}
                  </Anchor>
                </Table.Td>
                <Table.Td>{ORIGEM_LABELS[i.origem]}</Table.Td>
                <Table.Td>
                  <SituacaoBadge situacao={i.situacao} />
                </Table.Td>
                <Table.Td className={classes.numero}>{total(i.totais?.lidas)}</Table.Td>
                <Table.Td className={classes.numero}>{total(i.totais?.importadas)}</Table.Td>
                <Table.Td className={classes.numero}>{total(i.totais?.corrigidas)}</Table.Td>
                <Table.Td className={classes.numero}>{total(i.totais?.descartadas)}</Table.Td>
                <Table.Td className={classes.acoes}>
                  <Button
                    component={Link}
                    to={`/importacoes/${i.id}`}
                    leftSection={<Eye size={16} strokeWidth={1.75} />}
                    onClick={naoSobeParaALinha}
                  >
                    Ver detalhes
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={totalImportacoes} onChange={onChangePagina} />
    </Card>
  )
}

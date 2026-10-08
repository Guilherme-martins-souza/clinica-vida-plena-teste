import { Alert, Button, Card, Group, Select, Table, Text, Title } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useState } from 'react'
import { fetchDescartes, urlCsvDescartes, type MotivoDescarte } from '../../api/importacoes'
import { formatInteger } from '../../lib/format'
import { MOTIVO_LABELS } from '../../lib/importacao'
// Mesmo visual da tabela de agendamentos (estilo DataTable do design system).
import tableClasses from '../indicadores/AgendamentosTable.module.css'
import classes from './DescartesTable.module.css'

const POR_PAGINA = 30

type DescartesTableProps = {
  importacaoId: string
  /** Contagem por motivo, já calculada na importação: monta as opções do filtro sem buscar as linhas. */
  descartesPorMotivo: Partial<Record<MotivoDescarte, number>>
}

function isMotivo(value: string | null): value is MotivoDescarte {
  return value !== null && value in MOTIVO_LABELS
}

/** Linhas do CSV que não entraram, paginadas no backend, com filtro por motivo e o download do CSV. */
export function DescartesTable({ importacaoId, descartesPorMotivo }: DescartesTableProps) {
  const [motivo, setMotivo] = useState<MotivoDescarte | null>(null)
  const [pagina, setPagina] = useState(1)

  const filtro = { motivo, pagina, porPagina: POR_PAGINA }
  const query = useQuery({
    queryKey: ['importacoes', importacaoId, 'descartes', filtro],
    queryFn: () => fetchDescartes(importacaoId, filtro),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })

  const total = query.data?.total ?? 0
  const linhas = query.data?.itens ?? []
  const inicio = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const fim = Math.min(pagina * POR_PAGINA, total)

  // Opções do filtro: só os motivos que aparecem nesta importação, na ordem das regras, com a contagem.
  let totalGeral = 0
  const motivoOptions: { value: string; label: string }[] = []
  for (const [value, label] of Object.entries(MOTIVO_LABELS)) {
    const n = isMotivo(value) ? (descartesPorMotivo[value] ?? 0) : 0
    totalGeral += n
    if (n > 0) motivoOptions.push({ value, label: `${label} (${formatInteger(n)})` })
  }

  return (
    <Card component="section" padding={0} className={tableClasses.card}>
      <Group justify="space-between" gap="sm" className={tableClasses.toolbar}>
        <Title order={2} fz="lg" lh="1.5rem">
          Linhas descartadas
          <Text span fz="sm" fw={400} c="dimmed" ml="xs" className={tableClasses.num}>
            {motivo ? `${formatInteger(total)} de ${formatInteger(totalGeral)}` : formatInteger(totalGeral)}
          </Text>
        </Title>
        <Group gap="xs" className={classes.acoes}>
          <Select
            aria-label="Motivo"
            placeholder="Todos os motivos"
            data={motivoOptions}
            value={motivo}
            onChange={(v) => {
              setMotivo(isMotivo(v) ? v : null)
              setPagina(1)
            }}
            clearable
            maxDropdownHeight="30rem" // cabem todos os motivos sem rolagem escondida
            className={classes.motivo}
          />
          <Button
            component="a"
            href={urlCsvDescartes(importacaoId)}
            download
            leftSection={<Download size={16} strokeWidth={1.75} />}
          >
            Baixar CSV de descartes
          </Button>
        </Group>
      </Group>

      {query.isError && (
        <Alert color="red" title="Não foi possível carregar as linhas descartadas" mx="md" mb="md">
          {query.error.message}
        </Alert>
      )}

      <Table.ScrollContainer minWidth="45rem" type="native">
        <Table
          highlightOnHover
          tabularNums
          verticalSpacing="0.625rem"
          horizontalSpacing="sm"
          className={tableClasses.table}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Linha</Table.Th>
              <Table.Th>ID</Table.Th>
              <Table.Th>Paciente</Table.Th>
              <Table.Th>Consulta</Table.Th>
              <Table.Th>Motivo</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {linhas.map((d) => (
              <Table.Tr key={d.linha}>
                <Table.Td>{formatInteger(d.linha)}</Table.Td>
                <Table.Td className={tableClasses.id}>{d.codigo}</Table.Td>
                <Table.Td>
                  {d.valores.paciente_nome || '—'}
                  <small>{d.valores.paciente_id}</small>
                </Table.Td>
                {/* Como veio no arquivo: a data pode estar num formato que a importação não aceitou. */}
                <Table.Td>{d.valores.data_consulta || '—'}</Table.Td>
                <Table.Td>{MOTIVO_LABELS[d.motivo]}</Table.Td>
              </Table.Tr>
            ))}
            {query.isSuccess && linhas.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">
                    {motivo ? 'Nenhuma linha descartada com esse motivo.' : 'Nenhuma linha foi descartada.'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Group justify="space-between" gap="sm" className={tableClasses.foot}>
        <span className={tableClasses.num}>
          {inicio}–{fim} de {formatInteger(total)}
        </span>
        <Group gap="xs">
          <Button
            leftSection={<ChevronLeft size={16} strokeWidth={1.75} />}
            disabled={pagina === 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            rightSection={<ChevronRight size={16} strokeWidth={1.75} />}
            disabled={fim >= total}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </Group>
      </Group>
    </Card>
  )
}

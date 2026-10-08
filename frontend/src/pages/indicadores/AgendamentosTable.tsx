import { Card, Group, SegmentedControl, Select, Table, Text, TextInput, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, Search } from 'lucide-react'
import { useState } from 'react'
import { fetchAgendamentos, type AgendamentosQuando } from '../../api/indicadores'
import { medicosMock } from '../../api/mocks/agendamentos.mock'
import type { AgendamentoStatus, Periodo, TipoAtendimento } from '../../api/types'
import { Paginacao } from '../../components/Paginacao'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDate, formatInteger, formatTime } from '../../lib/format'
import { isStatus, statusOptions } from '../../lib/status'
import classes from './AgendamentosTable.module.css'

const POR_PAGINA = 8

const TIPO_LABEL: Record<TipoAtendimento, string> = { convenio: 'Convênio', particular: 'Particular' }

// TODO: trocar pela lista de médicos vinda da API.
const medicoOptions = medicosMock.map((m) => ({ value: m.id, label: m.nome }))

/** Tabela de agendamentos do período, com busca, filtros e paginação. */
export function AgendamentosTable({ periodo }: { periodo: Periodo }) {
  const [busca, setBusca] = useState('')
  const [buscaDebounced] = useDebouncedValue(busca, 300)
  const [status, setStatus] = useState<AgendamentoStatus | null>(null)
  const [medicoId, setMedicoId] = useState<string | null>(null)
  const [quando, setQuando] = useState<AgendamentosQuando>('hoje')
  const [pagina, setPagina] = useState(1)

  const filtro = { periodo, quando, busca: buscaDebounced, status, medicoId, pagina, porPagina: POR_PAGINA }
  const query = useQuery({
    queryKey: ['agendamentos', filtro],
    queryFn: () => fetchAgendamentos(filtro),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })

  const total = query.data?.total ?? 0
  const itens = query.data?.itens ?? []

  return (
    <Card component="section" padding={0} className={classes.card}>
      <Group justify="space-between" gap="sm" className={classes.toolbar}>
        <Title order={2} fz="lg" lh="1.5rem">
          Agendamentos
          <Text span fz="sm" fw={400} c="dimmed" ml="xs" className={classes.num}>
            {formatInteger(total)} {quando === 'hoje' ? 'hoje' : 'no período'}
          </Text>
        </Title>
        <Group gap="xs" className={classes.filters}>
          <SegmentedControl
            aria-label="Quais agendamentos mostrar"
            data={[
              { value: 'hoje', label: 'Hoje' },
              { value: 'todos', label: 'Todos' },
            ]}
            value={quando}
            onChange={(v) => {
              setQuando(v === 'todos' ? 'todos' : 'hoje')
              setPagina(1)
            }}
          />
          <TextInput
            type="search"
            aria-label="Buscar"
            placeholder="Buscar paciente"
            leftSection={<Search size={16} strokeWidth={1.75} />}
            value={busca}
            onChange={(e) => {
              setBusca(e.currentTarget.value)
              setPagina(1)
            }}
            className={classes.search}
          />
          <Select
            aria-label="Status"
            placeholder="Todos os status"
            data={statusOptions}
            value={status}
            onChange={(v) => {
              setStatus(isStatus(v) ? v : null)
              setPagina(1)
            }}
            clearable
            className={classes.select}
          />
          <Select
            aria-label="Médico"
            placeholder="Todos os médicos"
            data={medicoOptions}
            value={medicoId}
            onChange={(v) => {
              setMedicoId(v)
              setPagina(1)
            }}
            clearable
            className={classes.select}
          />
        </Group>
      </Group>

      <Table.ScrollContainer minWidth="50rem" type="native">
        <Table highlightOnHover tabularNums verticalSpacing="0.625rem" horizontalSpacing="sm" className={classes.table}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Paciente</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Médico</Table.Th>
              <Table.Th>Marcada em</Table.Th>
              <Table.Th aria-sort="descending">
                <span className={classes.sorted}>
                  Consulta
                  <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
              </Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens.map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td className={classes.id}>#{a.id}</Table.Td>
                <Table.Td>
                  {a.paciente.nome}
                  <small>{a.paciente.telefone}</small>
                </Table.Td>
                <Table.Td>{TIPO_LABEL[a.tipo]}</Table.Td>
                <Table.Td>
                  {a.medico.nome}
                  <small>{a.medico.especialidade}</small>
                </Table.Td>
                <Table.Td>{formatDate(a.marcadaEm)}</Table.Td>
                <Table.Td>
                  {formatDate(a.consultaEm)}
                  <small>{formatTime(a.consultaEm)}</small>
                </Table.Td>
                <Table.Td>
                  <StatusBadge status={a.status} />
                </Table.Td>
              </Table.Tr>
            ))}
            {query.isSuccess && itens.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" ta="center" py="md">
                    {quando === 'hoje'
                      ? 'Nenhum agendamento para hoje com esses filtros.'
                      : 'Nenhum agendamento encontrado com esses filtros.'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={total} onChange={setPagina} />
    </Card>
  )
}

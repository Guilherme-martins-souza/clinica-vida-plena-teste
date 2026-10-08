import { Alert, Card, Group, Table, Text, TextInput, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { fetchPacientes } from '../../api/pacientes'
import { PageHeader } from '../../components/PageHeader'
import { Paginacao } from '../../components/Paginacao'
import { formatInteger, formatPercent, formatTelefone, rate } from '../../lib/format'
import tableClasses from '../indicadores/AgendamentosTable.module.css'
import classes from './PacientesPage.module.css'

const POR_PAGINA = 10

export function PacientesPage() {
  const [busca, setBusca] = useState('')
  // Espera a pessoa parar de digitar antes de buscar, para não chamar a API a cada tecla.
  const [buscaDebounced] = useDebouncedValue(busca, 300)
  const [pagina, setPagina] = useState(1)

  const filtro = { busca: buscaDebounced, pagina, porPagina: POR_PAGINA }
  const query = useQuery({
    queryKey: ['pacientes', filtro],
    queryFn: () => fetchPacientes(filtro),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })

  const total = query.data?.total ?? 0
  const pacientes = query.data?.itens ?? []

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Pacientes da clínica e o histórico de faltas de cada um, em todas as consultas."
      />

      <Card component="section" padding={0} className={tableClasses.card}>
        <Group justify="space-between" gap="sm" className={tableClasses.toolbar}>
          <Title order={2} fz="lg" lh="1.5rem">
            Pacientes
            <Text span fz="sm" fw={400} c="dimmed" ml="xs" className={tableClasses.num}>
              {formatInteger(total)}
            </Text>
          </Title>
          <TextInput
            type="search"
            aria-label="Buscar paciente pelo nome"
            placeholder="Buscar paciente"
            leftSection={<Search size={16} strokeWidth={1.75} />}
            value={busca}
            onChange={(e) => {
              setBusca(e.currentTarget.value)
              setPagina(1)
            }}
            className={tableClasses.search}
          />
        </Group>

        {query.isError && (
          <Alert color="red" title="Não foi possível carregar os pacientes" mx="md" mb="md">
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
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Telefone</Table.Th>
                <Table.Th className={classes.numero}>Concluídas</Table.Th>
                <Table.Th className={classes.numero}>Faltas</Table.Th>
                <Table.Th className={classes.numero}>Taxa de falta</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pacientes.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td className={tableClasses.id}>{p.id}</Table.Td>
                  <Table.Td>{p.nome}</Table.Td>
                  <Table.Td>{p.telefone ? formatTelefone(p.telefone) : '—'}</Table.Td>
                  <Table.Td className={classes.numero}>{formatInteger(p.concluidas)}</Table.Td>
                  <Table.Td className={classes.numero}>{formatInteger(p.faltas)}</Table.Td>
                  <Table.Td className={classes.numero}>
                    {/* Sem consulta concluída não há taxa. */}
                    {p.concluidas === 0 ? '—' : formatPercent(rate(p.faltas, p.concluidas))}
                  </Table.Td>
                </Table.Tr>
              ))}
              {query.isSuccess && pacientes.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" ta="center" py="md">
                      Nenhum paciente encontrado.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={total} onChange={setPagina} />
      </Card>
    </>
  )
}

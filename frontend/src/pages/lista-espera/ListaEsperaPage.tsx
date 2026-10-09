import { Alert, Button, Card, Group, Table, Text, Title } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { listarEspera } from '../../api/lista-espera'
import { fetchMedicos } from '../../api/medicos'
import tableClasses from '../../components/DataTable.module.css'
import { PageHeader } from '../../components/PageHeader'
import { Paginacao } from '../../components/Paginacao'
import { formatDate, formatInteger, formatTelefone } from '../../lib/format'
import { ListaEsperaDrawer } from './ListaEsperaDrawer'

const POR_PAGINA = 10

/** Tela da recepção: quem espera uma vaga (da mais antiga para a mais nova) e o painel para cadastrar mais gente. */
export function ListaEsperaPage() {
  const [novoAberto, setNovoAberto] = useState(false)
  const [pagina, setPagina] = useState(1)

  const lista = useQuery({
    queryKey: ['lista-espera', 'todas', pagina],
    queryFn: () => listarEspera({ medicoId: null, pagina, porPagina: POR_PAGINA }),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })
  // A lista só guarda o id do médico: o nome vem da lista de médicos.
  const medicos = useQuery({
    queryKey: ['medicos', 'todos'],
    queryFn: () => fetchMedicos({ busca: '', pagina: 1, porPagina: 100 }),
  })

  const total = lista.data?.total ?? 0
  const pessoas = lista.data?.itens ?? []

  function nomeDoMedico(medicoId: string | null): string {
    if (medicoId === null) return 'Qualquer médico'
    return medicos.data?.itens.find((m) => m.id === medicoId)?.nome ?? medicoId
  }

  return (
    <>
      <PageHeader
        title="Lista de espera"
        description="Pessoas que aguardam uma vaga e podem ser avisadas quando uma consulta for liberada."
        actions={
          <Button
            variant="filled"
            leftSection={<Plus size={16} strokeWidth={1.75} />}
            onClick={() => setNovoAberto(true)}
          >
            Adicionar na lista de espera
          </Button>
        }
      />

      <Card component="section" padding={0} className={tableClasses.card}>
        <Group gap="sm" className={tableClasses.toolbar}>
          <Title order={2} fz="lg" lh="1.5rem">
            Lista de espera
            <Text span fz="sm" fw={400} c="dimmed" ml="xs" className={tableClasses.num}>
              {formatInteger(total)}
            </Text>
          </Title>
        </Group>

        {lista.isError && (
          <Alert color="red" title="Não foi possível carregar a lista de espera" mx="md" mb="md">
            {lista.error.message}
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
                <Table.Th>Nome</Table.Th>
                <Table.Th>Telefone</Table.Th>
                <Table.Th>Médico</Table.Th>
                <Table.Th>Quer antecipar</Table.Th>
                <Table.Th>Na espera desde</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pessoas.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.nome}</Table.Td>
                  <Table.Td>{formatTelefone(p.telefone)}</Table.Td>
                  <Table.Td>{nomeDoMedico(p.medicoId)}</Table.Td>
                  <Table.Td>{p.antecipar ? 'Sim' : 'Não'}</Table.Td>
                  <Table.Td>{formatDate(p.criadoEm)}</Table.Td>
                </Table.Tr>
              ))}
              {lista.isSuccess && pessoas.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center" py="md">
                      Ninguém na lista de espera.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={total} onChange={setPagina} />
      </Card>

      <ListaEsperaDrawer aberto={novoAberto} onFechar={() => setNovoAberto(false)} />
    </>
  )
}

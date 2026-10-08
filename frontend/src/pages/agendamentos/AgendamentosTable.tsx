import { Alert, Card, Group, Select, Table, Tabs, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Lock, Search } from 'lucide-react'
import { useState } from 'react'
import { alterarStatus, fetchConsultas, fetchContagens, type Aba, type ConsultaLinha } from '../../api/consultas'
import { fetchMedicos } from '../../api/medicos'
import type { AgendamentoStatus, TipoAtendimento } from '../../api/types'
import { avisarErro, avisarSucesso } from '../../components/avisos'
import { Paginacao } from '../../components/Paginacao'
import { StatusBadge } from '../../components/StatusBadge'
import tableClasses from '../../components/DataTable.module.css'
import { formatDate, formatInteger, formatTelefone, formatTime } from '../../lib/format'
import { isStatus, STATUS_LABELS, statusOptions } from '../../lib/status'
import { ehFinal } from '../../lib/transicoes'
import { PeriodoOpcional } from './PeriodoOpcional'
import { StatusMenu } from './StatusMenu'
import classes from './AgendamentosTable.module.css'

const POR_PAGINA = 10

const TIPO_LABEL: Record<TipoAtendimento, string> = { convenio: 'Convênio', particular: 'Particular' }

const ABAS: { value: Aba; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'proximas', label: 'Próximas' },
  { value: 'aguardando', label: 'Aguardando registro' },
  { value: 'todas', label: 'Todas' },
]

function isAba(value: string | null): value is Aba {
  return ABAS.some((a) => a.value === value)
}

const VAZIO: Record<Aba, string> = {
  hoje: 'Nenhuma consulta hoje com esses filtros.',
  proximas: 'Nenhuma consulta próxima com esses filtros.',
  aguardando: 'Nenhuma consulta esperando registro. Tudo em dia.',
  todas: 'Nenhuma consulta encontrada com esses filtros.',
}

/** A consulta já começou e continua agendada ou confirmada: falta registrar o que aconteceu. */
function aguardandoRegistro(c: ConsultaLinha, agora: Date): boolean {
  return (c.status === 'agendada' || c.status === 'confirmada') && c.inicio.getTime() <= agora.getTime()
}

/** Lista de consultas com abas, filtros, paginação no servidor e a troca de status em cada linha. */
export function AgendamentosTable() {
  const [aba, setAba] = useState<Aba>('hoje')
  const [busca, setBusca] = useState('')
  // Espera a pessoa parar de digitar antes de buscar, para não chamar a API a cada tecla.
  const [buscaDebounced] = useDebouncedValue(busca, 300)
  const [status, setStatus] = useState<AgendamentoStatus | null>(null)
  const [medicoId, setMedicoId] = useState<string | null>(null)
  // Período (AAAA-MM-DD) só vale na aba Todas; sem período por padrão.
  const [de, setDe] = useState<string | null>(null)
  const [ate, setAte] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)

  const filtros = { busca: buscaDebounced, status, medicoId, de, ate }
  // As duas buscas começam com 'consultas': invalidar essa chave atualiza lista e contagens juntas.
  const lista = useQuery({
    queryKey: ['consultas', 'lista', { ...filtros, aba, pagina }],
    queryFn: () => fetchConsultas({ ...filtros, aba, pagina, porPagina: POR_PAGINA }),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })
  const contagens = useQuery({
    queryKey: ['consultas', 'contagens', filtros],
    queryFn: () => fetchContagens(filtros),
    placeholderData: keepPreviousData,
  })
  // Os 6 médicos cabem numa página só.
  const medicos = useQuery({ queryKey: ['medicos', 'todos'], queryFn: () => fetchMedicos(1, 100) })
  const medicoOptions = (medicos.data?.itens ?? []).map((m) => ({ value: m.id, label: m.nome }))

  const queryClient = useQueryClient()
  const troca = useMutation({
    mutationFn: ({ consulta, novo }: { consulta: ConsultaLinha; novo: AgendamentoStatus }) =>
      alterarStatus(consulta.id, novo),
    onSuccess: (_resposta, { consulta, novo }) => {
      avisarSucesso('Status alterado', `Agendamento #${consulta.codigo} agora está como ${STATUS_LABELS[novo]}.`)
    },
    onError: (erro) => avisarErro('Não foi possível alterar o status', erro.message),
    // Com sucesso ou erro, busca de novo: a linha e as contagens mostram o que está gravado.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['consultas'] }),
  })

  /** Troca um filtro e volta para a primeira página. */
  function mudar<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v)
      setPagina(1)
    }
  }

  const total = lista.data?.total ?? 0
  const itens = lista.data?.itens ?? []
  // "Agora" de quando a lista chegou do servidor: marca as linhas que esperam registro.
  const carregadaEm = new Date(lista.dataUpdatedAt)
  // Hoje e Próximas: mais perto primeiro. Aguardando e Todas: mais recente primeiro.
  const crescente = aba === 'hoje' || aba === 'proximas'

  return (
    <Card component="section" padding={0} className={tableClasses.card}>
      <Tabs
        value={aba}
        onChange={(v) => {
          if (isAba(v)) mudar(setAba)(v)
        }}
        classNames={{ list: classes.abas }}
      >
        <Tabs.List aria-label="Recorte">
          {ABAS.map((a) => (
            <Tabs.Tab
              key={a.value}
              value={a.value}
              rightSection={
                <span className={classes.contagem} data-tom={a.value === 'aguardando' ? 'warning' : undefined}>
                  {contagens.data ? formatInteger(contagens.data[a.value]) : '–'}
                </span>
              }
            >
              {a.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value={aba}>
          <Group justify="space-between" gap="sm" className={tableClasses.toolbar}>
            <Group gap="xs" className={tableClasses.filters}>
              <TextInput
                type="search"
                aria-label="Buscar paciente"
                placeholder="Buscar paciente"
                leftSection={<Search size={16} strokeWidth={1.75} />}
                value={busca}
                onChange={(e) => mudar(setBusca)(e.currentTarget.value)}
                className={tableClasses.search}
              />
              <Select
                aria-label="Status"
                placeholder="Todos os status"
                data={statusOptions}
                value={status}
                onChange={(v) => mudar(setStatus)(isStatus(v) ? v : null)}
                clearable
                className={tableClasses.select}
              />
              <Select
                aria-label="Médico"
                placeholder="Todos os médicos"
                data={medicoOptions}
                value={medicoId}
                onChange={mudar(setMedicoId)}
                clearable
                className={tableClasses.select}
              />
            </Group>
            {aba === 'todas' && (
              <PeriodoOpcional
                de={de}
                ate={ate}
                onChange={(novoDe, novoAte) => {
                  setDe(novoDe)
                  setAte(novoAte)
                  setPagina(1)
                }}
              />
            )}
          </Group>

          {lista.isError && (
            <Alert color="red" title="Não foi possível carregar os agendamentos" mx="md" mb="md">
              {lista.error.message}
            </Alert>
          )}

          <Table.ScrollContainer minWidth="56rem" type="native">
            <Table
              highlightOnHover
              tabularNums
              verticalSpacing="0.625rem"
              horizontalSpacing="sm"
              className={tableClasses.table}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Paciente</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Médico</Table.Th>
                  <Table.Th aria-sort={crescente ? 'ascending' : 'descending'}>
                    <span className={tableClasses.sorted}>
                      Consulta
                      {crescente ? (
                        <ArrowUp size={16} strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </span>
                  </Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th aria-label="Ações" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {itens.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td className={tableClasses.id}>#{c.codigo}</Table.Td>
                    <Table.Td>
                      {c.paciente.nome}
                      {c.primeiraConsulta && <span className={classes.etiqueta}>1ª consulta</span>}
                      <small>{c.paciente.telefone ? formatTelefone(c.paciente.telefone) : '—'}</small>
                    </Table.Td>
                    <Table.Td>{TIPO_LABEL[c.tipoAtendimento]}</Table.Td>
                    <Table.Td>
                      {c.medico.nome}
                      <small>{c.medico.especialidade}</small>
                    </Table.Td>
                    <Table.Td>
                      {formatDate(c.inicio)}
                      <small>{formatTime(c.inicio)}</small>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={c.status} />
                      {aguardandoRegistro(c, carregadaEm) && (
                        <span className={classes.pendente}>Aguardando registro</span>
                      )}
                    </Table.Td>
                    <Table.Td className={classes.acoes}>
                      {ehFinal(c.status) ? (
                        <span className={classes.final}>
                          <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
                          Status final
                        </span>
                      ) : (
                        <StatusMenu
                          status={c.status}
                          inicio={c.inicio}
                          carregando={troca.isPending && troca.variables.consulta.id === c.id}
                          onChange={(novo) => troca.mutate({ consulta: c, novo })}
                        />
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {lista.isSuccess && itens.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text c="dimmed" ta="center" py="md">
                        {VAZIO[aba]}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={total} onChange={setPagina} />
        </Tabs.Panel>
      </Tabs>
    </Card>
  )
}

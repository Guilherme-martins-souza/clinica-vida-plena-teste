import { Button, Group, Table, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, MessageCircle } from 'lucide-react'
import { alterarStatus } from '../../api/consultas'
import { enviarMensagem, type ConsultaPrevencao, type TipoMensagem } from '../../api/prevencao'
import type { AgendamentoStatus } from '../../api/types'
import { avisarErro, avisarSucesso } from '../../components/avisos'
import tableClasses from '../../components/DataTable.module.css'
import { FaltosoChip } from '../../components/FaltosoChip'
import { RiscoChip } from '../../components/RiscoChip'
import { StatusBadge } from '../../components/StatusBadge'
import { StatusMenu } from '../../components/StatusMenu'
import { formatDate, formatTelefone, formatTime } from '../../lib/format'
import { STATUS_LABELS } from '../../lib/status'
import classes from './PrevencaoTable.module.css'

const MENSAGEM_LABEL: Record<TipoMensagem, string> = { confirmacao: 'Confirmação', lembrete: 'Lembrete' }

type PrevencaoTableProps = {
  itens: ConsultaPrevencao[]
  /** Mostra a linha de "nenhuma consulta" quando a lista já carregou e veio vazia. */
  vazia: boolean
}

/** Linhas da aba: paciente, médico, horário, status, chance de faltar e as ações da recepção. */
export function PrevencaoTable({ itens, vazia }: PrevencaoTableProps) {
  const queryClient = useQueryClient()

  const troca = useMutation({
    mutationFn: ({ consulta, novo }: { consulta: ConsultaPrevencao; novo: AgendamentoStatus }) =>
      alterarStatus(consulta.id, novo),
    onSuccess: (_resposta, { consulta, novo }) => {
      avisarSucesso('Status alterado', `Agendamento #${consulta.codigo} agora está como ${STATUS_LABELS[novo]}.`)
    },
    onError: (erro) => avisarErro('Não foi possível alterar o status', erro.message),
    // Com sucesso ou erro, busca de novo: a linha mostra o que está gravado (e o risco recalculado).
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['prevencao'] }),
  })

  const envio = useMutation({
    mutationFn: ({ consulta, tipo }: { consulta: ConsultaPrevencao; tipo: TipoMensagem }) =>
      enviarMensagem(consulta.id, tipo),
    onSuccess: (_resposta, { consulta, tipo }) => {
      avisarSucesso(
        'Mensagem enviada',
        `${MENSAGEM_LABEL[tipo]} enviada para ${consulta.paciente.nome}. Veja em localhost:8025.`,
      )
    },
    onError: (erro) => avisarErro('Não foi possível enviar a mensagem', erro.message),
  })

  /** Copia o telefone no formato (51) 97365-2906. */
  async function copiarContato(consulta: ConsultaPrevencao) {
    if (!consulta.paciente.telefone) return
    try {
      await navigator.clipboard.writeText(formatTelefone(consulta.paciente.telefone))
      avisarSucesso('Contato copiado', `Telefone de ${consulta.paciente.nome} copiado.`)
    } catch {
      avisarErro('Não foi possível copiar', 'O navegador não deixou usar a área de transferência.')
    }
  }

  /** O botão de um tipo está carregando só na linha e no tipo que estão sendo enviados. */
  function enviando(consulta: ConsultaPrevencao, tipo: TipoMensagem): boolean {
    return envio.isPending && envio.variables.consulta.id === consulta.id && envio.variables.tipo === tipo
  }

  return (
    <Table.ScrollContainer minWidth="62rem" type="native">
      <Table
        highlightOnHover
        tabularNums
        verticalSpacing="0.625rem"
        horizontalSpacing="sm"
        className={tableClasses.table}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Paciente</Table.Th>
            <Table.Th>Médico</Table.Th>
            <Table.Th>Consulta</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Chance de faltar</Table.Th>
            <Table.Th>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {itens.map((c) => {
            const semTelefone = c.paciente.telefone === null
            return (
              <Table.Tr key={c.id}>
                <Table.Td>
                  {c.paciente.nome}
                  {c.faltoso && <FaltosoChip />}
                  <small>{c.paciente.telefone ? formatTelefone(c.paciente.telefone) : 'Sem telefone cadastrado'}</small>
                </Table.Td>
                <Table.Td>
                  {c.medico.nome}
                  <small>{c.medico.especialidade}</small>
                </Table.Td>
                <Table.Td>
                  {formatDate(c.inicio)}
                  <small>{formatTime(c.inicio)}</small>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" className={classes.status}>
                    <StatusBadge status={c.status} />
                    <StatusMenu
                      status={c.status}
                      inicio={c.inicio}
                      carregando={troca.isPending && troca.variables.consulta.id === c.id}
                      onChange={(novo) => troca.mutate({ consulta: c, novo })}
                    />
                  </Group>
                </Table.Td>
                <Table.Td>
                  <RiscoChip nivel={c.risco.nivel} />
                  <small>{c.risco.pontos} pontos</small>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="xs"
                      leftSection={<MessageCircle size={16} strokeWidth={1.75} />}
                      disabled={c.status === 'confirmada' || semTelefone}
                      loading={enviando(c, 'confirmacao')}
                      onClick={() => envio.mutate({ consulta: c, tipo: 'confirmacao' })}
                    >
                      Enviar confirmação
                    </Button>
                    <Button
                      size="xs"
                      leftSection={<MessageCircle size={16} strokeWidth={1.75} />}
                      disabled={semTelefone}
                      loading={enviando(c, 'lembrete')}
                      onClick={() => envio.mutate({ consulta: c, tipo: 'lembrete' })}
                    >
                      Enviar lembrete
                    </Button>
                    <Button
                      size="xs"
                      leftSection={<Copy size={16} strokeWidth={1.75} />}
                      disabled={semTelefone}
                      onClick={() => copiarContato(c)}
                    >
                      Copiar contato
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            )
          })}
          {vazia && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center" py="md" className={classes.vazio}>
                  Nenhuma consulta de risco nos próximos 14 dias com esse filtro.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

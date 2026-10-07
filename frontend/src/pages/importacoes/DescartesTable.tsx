import { Button, Card, Group, Select, Table, Text, Title } from '@mantine/core'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { urlCsvDescartes, type Descarte, type MotivoDescarte } from '../../api/importacoes'
import { formatInteger } from '../../lib/format'
import { filtrarDescartes, MOTIVO_LABELS } from '../../lib/importacao'
// Mesmo visual da tabela de agendamentos (estilo DataTable do design system).
import tableClasses from '../indicadores/AgendamentosTable.module.css'
import classes from './DescartesTable.module.css'

type DescartesTableProps = {
  importacaoId: string
  descartes: Descarte[]
}

function isMotivo(value: string | null): value is MotivoDescarte {
  return value !== null && value in MOTIVO_LABELS
}

/** Linhas do CSV que não entraram, com filtro por motivo e o download do CSV. */
export function DescartesTable({ importacaoId, descartes }: DescartesTableProps) {
  const [motivo, setMotivo] = useState<MotivoDescarte | null>(null)
  const linhas = filtrarDescartes(descartes, motivo)

  // Opções do filtro: só os motivos que aparecem nesta importação, na ordem das regras, com a contagem.
  const motivoOptions = Object.entries(MOTIVO_LABELS)
    .map(([value, label]) => ({ value, label, total: descartes.filter((d) => d.motivo === value).length }))
    .filter((o) => o.total > 0)
    .map((o) => ({ value: o.value, label: `${o.label} (${formatInteger(o.total)})` }))

  return (
    <Card component="section" padding={0} className={tableClasses.card}>
      <Group justify="space-between" gap="sm" className={tableClasses.toolbar}>
        <Title order={2} fz="lg" lh="1.5rem">
          Linhas descartadas
          <Text span fz="sm" fw={400} c="dimmed" ml="xs" className={tableClasses.num}>
            {motivo
              ? `${formatInteger(linhas.length)} de ${formatInteger(descartes.length)}`
              : formatInteger(descartes.length)}
          </Text>
        </Title>
        <Group gap="xs" className={classes.acoes}>
          <Select
            aria-label="Motivo"
            placeholder="Todos os motivos"
            data={motivoOptions}
            value={motivo}
            onChange={(v) => setMotivo(isMotivo(v) ? v : null)}
            clearable
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
            {linhas.length === 0 && (
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
    </Card>
  )
}

import { Alert, Card, EmptyState, Skeleton, Table } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { DIAS_SEMANA, fetchMedicos, type GradeItem, type MedicoComGrade } from '../../api/medicos'
import { PageHeader } from '../../components/PageHeader'
import { Paginacao } from '../../components/Paginacao'
import tableClasses from '../indicadores/AgendamentosTable.module.css'
import classes from './MedicosPage.module.css'

const POR_PAGINA = 10

// Abreviação de cada dia, na ordem de DIAS_SEMANA (domingo a sábado).
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// "Seg, Qua e Sex"
const listaFormat = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

/** Dias em ordem como texto: três ou mais dias seguidos viram "Seg a Sex"; os outros, uma lista "Ter e Qui". */
function formatarDias(dias: number[]): string {
  const partes: string[] = []
  let i = 0
  while (i < dias.length) {
    // Avança enquanto o próximo dia for o seguinte deste.
    let j = i
    while (j + 1 < dias.length && dias[j + 1] === dias[j] + 1) j++
    if (j - i >= 2) partes.push(`${DIAS_CURTOS[dias[i]]} a ${DIAS_CURTOS[dias[j]]}`)
    else for (let k = i; k <= j; k++) partes.push(DIAS_CURTOS[dias[k]])
    i = j + 1
  }
  return listaFormat.format(partes)
}

/**
 * Grade agrupada por horário, uma linha por horário.
 * Ex.: seg a sex das 07:00 às 12:00 → ["Seg a Sex · 07:00–12:00"].
 */
function formatarGrade(grade: GradeItem[]): string[] {
  const diasPorHorario = new Map<string, number[]>()
  for (const item of grade) {
    const horario = `${item.inicio}–${item.fim}`
    const dias = diasPorHorario.get(horario) ?? []
    const dia = DIAS_SEMANA.indexOf(item.dia)
    if (!dias.includes(dia)) dias.push(dia)
    diasPorHorario.set(horario, dias)
  }

  // Ordena os horários pelo primeiro dia e, no mesmo dia, pelo início.
  const grupos = [...diasPorHorario].map(([horario, dias]) => ({ horario, dias: dias.sort((a, b) => a - b) }))
  grupos.sort((a, b) => a.dias[0] - b.dias[0] || a.horario.localeCompare(b.horario))
  return grupos.map((g) => `${formatarDias(g.dias)} · ${g.horario}`)
}

export function MedicosPage() {
  const [pagina, setPagina] = useState(1)
  const query = useQuery({
    queryKey: ['medicos', pagina],
    queryFn: () => fetchMedicos(pagina, POR_PAGINA),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })

  return (
    <>
      <PageHeader title="Médicos" description="Médicos da clínica e os dias e horários de atendimento de cada um." />

      {query.isPending && <Skeleton h="15rem" radius="lg" />}
      {query.isError && (
        <Alert color="red" title="Não foi possível carregar os médicos">
          {query.error.message}
        </Alert>
      )}
      {query.isSuccess && query.data.total === 0 && (
        <EmptyState
          mx="auto"
          my="xl"
          maw="26.25rem"
          icon={<Stethoscope size={28} strokeWidth={1.75} />}
          title="Nenhum médico ainda"
          description="Os médicos vêm do arquivo medicos.json, importado ao subir o sistema."
        />
      )}
      {query.isSuccess && query.data.total > 0 && (
        <Card component="section" padding={0} className={tableClasses.card}>
          <MedicosTabela medicos={query.data.itens} />
          <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={query.data.total} onChange={setPagina} />
        </Card>
      )}
    </>
  )
}

function MedicosTabela({ medicos }: { medicos: MedicoComGrade[] }) {
  return (
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
            <Table.Th>Especialidade</Table.Th>
            <Table.Th>Grade</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {medicos.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td className={tableClasses.id}>{m.id}</Table.Td>
              <Table.Td>{m.nome}</Table.Td>
              <Table.Td>{m.especialidade}</Table.Td>
              <Table.Td>
                {formatarGrade(m.grade).map((linha) => (
                  <span key={linha} className={classes.grade}>
                    {linha}
                  </span>
                ))}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

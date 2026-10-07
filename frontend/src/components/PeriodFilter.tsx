import { Button, Group, SegmentedControl, Select, Stack } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Calendar } from 'lucide-react'
import type { Periodo } from '../api/types'
import { formatDateRange } from '../lib/format'
import { ATALHOS, isPeriodoAtalho, type PeriodoAtalho } from '../lib/periodo'

type PeriodFilterProps = {
  value: PeriodoAtalho
  periodo: Periodo
  onChange: (value: PeriodoAtalho) => void
}

/** Filtro de período da página: atalhos e um botão com o intervalo atual. */
export function PeriodFilter({ value, periodo, onChange }: PeriodFilterProps) {
  // Abaixo de 720px os quatro atalhos não cabem lado a lado: viram uma lista, e os controles ficam um embaixo do outro.
  const isNarrow = useMediaQuery('(max-width: 45em)') ?? false

  function handleChange(v: string | null) {
    if (isPeriodoAtalho(v)) onChange(v)
  }

  // TODO: abrir o seletor de datas no "Personalizado" (precisa do @mantine/dates).
  const intervalo = (
    <Button
      leftSection={<Calendar size={16} strokeWidth={1.75} />}
      styles={{ label: { fontVariantNumeric: 'tabular-nums' } }}
    >
      {formatDateRange(periodo.de, periodo.ate)}
    </Button>
  )

  if (isNarrow) {
    return (
      <Stack gap="xs" w="100%" role="group" aria-label="Período">
        <Select
          aria-label="Atalho de período"
          data={ATALHOS}
          value={value}
          onChange={handleChange}
          allowDeselect={false}
        />
        {intervalo}
      </Stack>
    )
  }

  return (
    <Group gap="xs" role="group" aria-label="Período">
      <SegmentedControl value={value} onChange={handleChange} data={ATALHOS} />
      {intervalo}
    </Group>
  )
}

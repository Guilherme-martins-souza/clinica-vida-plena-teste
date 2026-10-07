import { Button, Group, SegmentedControl } from '@mantine/core'
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
  return (
    <Group gap="xs" role="group" aria-label="Período">
      <SegmentedControl
        value={value}
        onChange={(v) => {
          if (isPeriodoAtalho(v)) onChange(v)
        }}
        data={ATALHOS}
      />
      {/* TODO: abrir o seletor de datas no "Personalizado" (precisa do @mantine/dates). */}
      <Button
        leftSection={<Calendar size={16} strokeWidth={1.75} />}
        styles={{ label: { fontVariantNumeric: 'tabular-nums' } }}
      >
        {formatDateRange(periodo.de, periodo.ate)}
      </Button>
    </Group>
  )
}

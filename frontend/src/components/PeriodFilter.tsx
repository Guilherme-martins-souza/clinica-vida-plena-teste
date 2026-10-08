import { Button, Group, Popover, SegmentedControl, Select, Stack } from '@mantine/core'
import { DatePicker, type DatesRangeValue } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import dayjs from 'dayjs'
import { Calendar } from 'lucide-react'
import { useState } from 'react'
import type { Periodo } from '../api/types'
import { formatDateRange } from '../lib/format'
import { ATALHOS, isPeriodoAtalho, toDataIso, type PeriodoAtalho } from '../lib/periodo'

type PeriodFilterProps = {
  value: PeriodoAtalho
  periodo: Periodo
  /** Escolheu um atalho (30 dias, 3 meses, 12 meses). */
  onChange: (value: Exclude<PeriodoAtalho, 'personalizado'>) => void
  /** Escolheu as duas datas no seletor (AAAA-MM-DD). */
  onChangeIntervalo: (de: string, ate: string) => void
}

/**
 * Filtro de período da página: atalhos e um botão com o intervalo atual.
 * "Personalizado" e o botão do intervalo abrem o seletor de datas; o período só muda
 * quando as duas datas são escolhidas.
 */
export function PeriodFilter({ value, periodo, onChange, onChangeIntervalo }: PeriodFilterProps) {
  // Abaixo de 720px os quatro atalhos não cabem lado a lado: viram uma lista, e os controles ficam um embaixo do outro.
  const isNarrow = useMediaQuery('(max-width: 45em)') ?? false
  const [aberto, setAberto] = useState(false)
  // Datas marcadas no seletor enquanto ele está aberto. Começa com o intervalo atual.
  const [rascunho, setRascunho] = useState<DatesRangeValue<string>>([null, null])

  function abrirSeletor() {
    setRascunho([toDataIso(periodo.de), toDataIso(periodo.ate)])
    setAberto(true)
  }

  function handleChange(v: string | null) {
    if (v === 'personalizado') abrirSeletor()
    else if (isPeriodoAtalho(v) && v !== 'personalizado') onChange(v)
  }

  function handleDatas(datas: DatesRangeValue<string>) {
    setRascunho(datas)
    const [de, ate] = datas
    if (de && ate) {
      onChangeIntervalo(de, ate)
      setAberto(false)
    }
  }

  // No desktop o seletor mostra dois meses: o anterior e o do fim do intervalo.
  const meses = isNarrow ? 1 : 2
  const mesInicial = dayjs(toDataIso(periodo.ate))
    .subtract(meses - 1, 'month')
    .format('YYYY-MM-DD')

  const intervalo = (
    <Popover opened={aberto} onChange={setAberto} position="bottom-end" shadow="md" trapFocus>
      <Popover.Target>
        <Button
          leftSection={<Calendar size={16} strokeWidth={1.75} />}
          styles={{ label: { fontVariantNumeric: 'tabular-nums' } }}
          onClick={() => (aberto ? setAberto(false) : abrirSeletor())}
          aria-haspopup="dialog"
          aria-expanded={aberto}
        >
          {formatDateRange(periodo.de, periodo.ate)}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <DatePicker
          type="range"
          allowSingleDateInRange
          numberOfColumns={meses}
          defaultDate={mesInicial}
          value={rascunho}
          onChange={handleDatas}
          aria-label="Escolher o período"
        />
      </Popover.Dropdown>
    </Popover>
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

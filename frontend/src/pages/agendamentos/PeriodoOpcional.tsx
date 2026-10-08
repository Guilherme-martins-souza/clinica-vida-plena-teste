import { Button, Group, Popover } from '@mantine/core'
import { DatePicker, type DatesRangeValue } from '@mantine/dates'
import { Calendar, X } from 'lucide-react'
import { useState } from 'react'
import { formatDateRange } from '../../lib/format'
import { fromDataIso } from '../../lib/periodo'

type PeriodoOpcionalProps = {
  /** Dias AAAA-MM-DD; os dois null quando não há período. */
  de: string | null
  ate: string | null
  onChange: (de: string | null, ate: string | null) => void
}

/**
 * Período da aba Todas: um botão que abre o calendário. Sem período, mostra "Qualquer data".
 * O período só muda quando as duas datas são escolhidas; "Limpar" volta para sem período.
 */
export function PeriodoOpcional({ de, ate, onChange }: PeriodoOpcionalProps) {
  const [aberto, setAberto] = useState(false)
  // Datas marcadas no calendário enquanto ele está aberto.
  const [rascunho, setRascunho] = useState<DatesRangeValue<string>>([de, ate])

  const dataDe = fromDataIso(de)
  const dataAte = fromDataIso(ate)
  const rotulo = dataDe && dataAte ? formatDateRange(dataDe, dataAte) : 'Qualquer data'

  function abrir() {
    setRascunho([de, ate])
    setAberto(true)
  }

  function escolher(datas: DatesRangeValue<string>) {
    setRascunho(datas)
    const [novoDe, novoAte] = datas
    if (novoDe && novoAte) {
      onChange(novoDe, novoAte)
      setAberto(false)
    }
  }

  return (
    <Popover opened={aberto} onChange={setAberto} position="bottom-end" shadow="md" trapFocus>
      <Popover.Target>
        <Button
          leftSection={<Calendar size={16} strokeWidth={1.75} />}
          styles={{ label: { fontVariantNumeric: 'tabular-nums' } }}
          onClick={() => (aberto ? setAberto(false) : abrir())}
          aria-haspopup="dialog"
          aria-expanded={aberto}
        >
          {rotulo}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <DatePicker
          type="range"
          allowSingleDateInRange
          value={rascunho}
          onChange={escolher}
          defaultDate={ate ?? undefined}
          aria-label="Escolher o período"
        />
        {de && ate && (
          <Group justify="flex-end" mt="xs">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<X size={14} strokeWidth={1.75} />}
              onClick={() => {
                onChange(null, null)
                setAberto(false)
              }}
            >
              Limpar período
            </Button>
          </Group>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}

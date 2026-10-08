import { Button, Text } from '@mantine/core'
import dayjs from 'dayjs'
import type { Slot } from '../../api/consultas'
import { formatTime } from '../../lib/format'
import classes from './SlotPicker.module.css'

type SlotPickerProps = {
  slots: Slot[]
  /** Início do slot escolhido (ISO), ou null. */
  selecionado: string | null
  onSelect: (inicio: string) => void
  /** Próximo dia (AAAA-MM-DD) com horário livre, para o atalho quando o dia não tem vaga. */
  proximoDiaComVaga: string | null
  onIrPara: (data: string) => void
  /** id do texto de erro do campo, para o aria-describedby. */
  erroId?: string
}

const SITUACAO_LABEL = { ocupado: 'ocupado', passado: 'já passou' }

/**
 * Horários de 30 min da grade do médico no dia, em Manhã e Tarde.
 * Ocupado e passado ficam tracejados e desabilitados; um selecionado por vez.
 * Sem horário livre, a grade vira uma frase com o atalho para o próximo dia com vaga.
 */
export function SlotPicker({ slots, selecionado, onSelect, proximoDiaComVaga, onIrPara, erroId }: SlotPickerProps) {
  if (!slots.some((s) => s.situacao === 'livre')) {
    return (
      <div className={classes.semVaga}>
        <Text fz="sm">{slots.length === 0 ? 'O médico não atende neste dia.' : 'Nenhum horário livre neste dia.'}</Text>
        {proximoDiaComVaga ? (
          <Button variant="subtle" size="xs" onClick={() => onIrPara(proximoDiaComVaga)}>
            Ver {dayjs(proximoDiaComVaga).locale('pt-br').format('ddd, DD/MM')}, o próximo dia com vaga
          </Button>
        ) : (
          <Text fz="sm" c="dimmed">
            Nenhum dia com vaga nos próximos 60 dias.
          </Text>
        )}
      </div>
    )
  }

  // Manhã: começa antes do meio-dia (horário de São Paulo).
  const manha = slots.filter((s) => formatTime(s.inicio) < '12:00')
  const tarde = slots.filter((s) => formatTime(s.inicio) >= '12:00')

  function botao(slot: Slot) {
    const iso = slot.inicio.toISOString()
    const hora = formatTime(slot.inicio)
    if (slot.situacao !== 'livre') {
      return (
        <button
          key={iso}
          type="button"
          className={classes.slot}
          disabled
          aria-label={`${hora}, ${SITUACAO_LABEL[slot.situacao]}`}
        >
          {hora}
        </button>
      )
    }
    return (
      <button
        key={iso}
        type="button"
        className={classes.slot}
        aria-pressed={iso === selecionado}
        aria-describedby={erroId}
        onClick={() => onSelect(iso)}
      >
        {hora}
      </button>
    )
  }

  return (
    <div className={classes.slots} role="group" aria-label="Horários">
      {manha.length > 0 && <span className={classes.periodo}>Manhã</span>}
      {manha.map(botao)}
      {tarde.length > 0 && <span className={classes.periodo}>Tarde</span>}
      {tarde.map(botao)}
    </div>
  )
}

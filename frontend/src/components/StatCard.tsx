import type { ReactNode } from 'react'
import { ActionIcon, Card, Group, Text, Tooltip, VisuallyHidden } from '@mantine/core'
import { ArrowDown, ArrowUp, Info } from 'lucide-react'
import classes from './StatCard.module.css'

type StatCardProps = {
  label: string
  /** Valor já formatado em pt-BR. */
  value: string
  /** Linha de contexto abaixo do número. */
  hint?: string
  /** Explicação do número, mostrada num balão ao passar o mouse, focar ou tocar no "i" ao lado do rótulo. */
  info?: ReactNode
  /**
   * Variação em relação ao período anterior. `tone` diz se é boa ou ruim (queda na taxa de falta é `good`);
   * `direction` diz se subiu ou desceu, e define a seta.
   */
  delta?: { text: string; tone: 'good' | 'bad'; direction: 'up' | 'down' }
}

/** Um número de destaque com rótulo e uma linha de contexto. */
export function StatCard({ label, value, hint, info, delta }: StatCardProps) {
  const Arrow = delta?.direction === 'up' ? ArrowUp : ArrowDown

  return (
    <Card component="section" className={classes.card}>
      <Group gap="xs" wrap="nowrap">
        <Text fz="sm" fw={500} c="dimmed">
          {label}
        </Text>
        {info && (
          <Tooltip
            label={info}
            multiline
            w="18rem"
            withArrow
            position="bottom-start"
            events={{ hover: true, focus: true, touch: true }}
          >
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Sobre ${label}`}>
              <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Text className={classes.value}>{value}</Text>
      <Group gap="xs" mt="xs" fz="xs" c="dimmed" lh="1rem">
        {delta && (
          <span className={classes.delta} data-tone={delta.tone}>
            <Arrow size={16} strokeWidth={1.75} aria-hidden="true" />
            {delta.text}
            <VisuallyHidden>{delta.tone === 'good' ? ' (melhora)' : ' (piora)'}</VisuallyHidden>
          </span>
        )}
        {hint && <span>{hint}</span>}
      </Group>
    </Card>
  )
}

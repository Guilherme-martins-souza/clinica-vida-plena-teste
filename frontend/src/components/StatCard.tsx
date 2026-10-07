import { Card, Group, Text, VisuallyHidden } from '@mantine/core'
import { ArrowDown, ArrowUp } from 'lucide-react'
import classes from './StatCard.module.css'

type StatCardProps = {
  label: string
  /** Valor já formatado em pt-BR. */
  value: string
  /** Linha de contexto abaixo do número. */
  hint?: string
  /**
   * Variação em relação ao período anterior. `tone` diz se é boa ou ruim (queda na taxa de falta é `good`);
   * `direction` diz se subiu ou desceu, e define a seta.
   */
  delta?: { text: string; tone: 'good' | 'bad'; direction: 'up' | 'down' }
}

/** Um número de destaque com rótulo e uma linha de contexto. */
export function StatCard({ label, value, hint, delta }: StatCardProps) {
  const Arrow = delta?.direction === 'up' ? ArrowUp : ArrowDown

  return (
    <Card component="section" className={classes.card}>
      <Text fz="sm" fw={500} c="dimmed">
        {label}
      </Text>
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

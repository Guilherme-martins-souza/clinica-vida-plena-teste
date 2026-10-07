import { Group, Text, Title } from '@mantine/core'

type CardHeaderProps = {
  title: string
  /** Nota curta à direita, como a regra de cálculo ("faltas ÷ consultas concluídas"). */
  note?: string
  order?: 2 | 3
}

/** Título do cartão com uma nota opcional à direita. */
export function CardHeader({ title, note, order = 2 }: CardHeaderProps) {
  return (
    <Group justify="space-between" align="baseline" gap="sm" mb="md" wrap="wrap">
      <Title order={order} fz="lg" lh="1.5rem">
        {title}
      </Title>
      {note && (
        <Text fz="xs" c="dimmed">
          {note}
        </Text>
      )}
    </Group>
  )
}

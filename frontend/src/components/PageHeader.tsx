import { Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  /** Filtros que valem para a página inteira, à direita do título. */
  actions?: ReactNode
}

/** Cabeçalho da página: título à esquerda, filtros da página à direita. Um por tela. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" gap="md">
      <div>
        <Title order={1} fz="xl" lh="2rem" style={{ letterSpacing: '-0.01em' }}>
          {title}
        </Title>
        {description && (
          <Text c="dimmed" mt={2}>
            {description}
          </Text>
        )}
      </div>
      {actions}
    </Group>
  )
}

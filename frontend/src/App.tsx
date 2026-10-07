import { Alert, Badge, Card, Container, Group, Loader, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'

type Health = {
  status: string
  mongo: string
}

async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health')
  if (!res.ok) {
    throw new Error(`A API respondeu ${res.status}`)
  }
  // res.json() devolve any; passamos por unknown para o tipo ser uma decisão explícita.
  const data: unknown = await res.json()
  return data as Health
}

function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth })

  return (
    <Container size="xs" py="xl">
      <Title order={2} mb="md">
        Clínica Vida Plena
      </Title>

      {health.isPending && <Loader />}

      {health.isError && (
        <Alert color="red" title="Não foi possível falar com a API">
          {health.error.message}
        </Alert>
      )}

      {health.isSuccess && (
        <Card withBorder>
          <Group justify="space-between">
            <Text>API</Text>
            <Badge color={health.data.status === 'ok' ? 'green' : 'red'}>{health.data.status}</Badge>
          </Group>
          <Group justify="space-between" mt="sm">
            <Text>MongoDB</Text>
            <Badge color={health.data.mongo === 'connected' ? 'green' : 'yellow'}>{health.data.mongo}</Badge>
          </Group>
        </Card>
      )}
    </Container>
  )
}

export default App

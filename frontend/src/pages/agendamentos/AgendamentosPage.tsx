import { Button } from '@mantine/core'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { AgendamentosTable } from './AgendamentosTable'
import { NovoAgendamentoDrawer } from './NovoAgendamentoDrawer'

/** Tela da recepção: lista com abas, troca de status em cada linha e o painel para marcar consulta. */
export function AgendamentosPage() {
  const [novoAberto, setNovoAberto] = useState(false)

  return (
    <>
      <PageHeader
        title="Agendamentos"
        description="Marque consultas e registre o que aconteceu com cada uma."
        actions={
          <Button
            variant="filled"
            leftSection={<Plus size={16} strokeWidth={1.75} />}
            onClick={() => setNovoAberto(true)}
          >
            Novo agendamento
          </Button>
        }
      />
      <AgendamentosTable />
      <NovoAgendamentoDrawer aberto={novoAberto} onFechar={() => setNovoAberto(false)} />
    </>
  )
}

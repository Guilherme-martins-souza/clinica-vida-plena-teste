import { Button, Code, EmptyState } from '@mantine/core'
import { House } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Tela provisória para rotas que ainda não foram construídas. */
export function EmConstrucaoPage({ description }: { description: ReactNode }) {
  return (
    <EmptyState
      mx="auto"
      my="xl"
      maw="26.25rem"
      icon={<House size={28} strokeWidth={1.75} />}
      title="Tela em construção"
      description={description}
    >
      <Button component={Link} to="/indicadores">
        Voltar para Indicadores
      </Button>
    </EmptyState>
  )
}

export function MedicosPage() {
  return (
    <EmConstrucaoPage
      description={
        <>
          O cadastro de médicos ainda não está disponível. Por enquanto, os médicos vêm do arquivo{' '}
          <Code>medicos.json</Code>.
        </>
      }
    />
  )
}

export function ImportacoesPage() {
  return (
    <EmConstrucaoPage
      description={
        <>
          A tela de importações ainda não está disponível. Por enquanto, os agendamentos vêm do arquivo{' '}
          <Code>agendamentos.csv</Code>.
        </>
      }
    />
  )
}

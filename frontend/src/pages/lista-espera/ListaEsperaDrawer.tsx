import { Alert, Button, Drawer, Group, Loader, Select, Switch } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { criarPessoaEspera } from '../../api/lista-espera'
import { fetchMedicos } from '../../api/medicos'
import { fetchPacientes, type PacienteResumo } from '../../api/pacientes'
import { avisarSucesso } from '../../components/avisos'
import { formatTelefone } from '../../lib/format'
import classes from './ListaEsperaDrawer.module.css'

type ListaEsperaDrawerProps = {
  aberto: boolean
  onFechar: () => void
}

/**
 * Painel lateral "Adicionar na lista de espera". Esc, o X, o fundo e "Cancelar" fecham sem salvar.
 * O formulário fica num componente à parte: o Drawer o desmonta ao fechar, então ele sempre abre vazio.
 */
export function ListaEsperaDrawer({ aberto, onFechar }: ListaEsperaDrawerProps) {
  return (
    <Drawer.Root
      opened={aberto}
      onClose={onFechar}
      position="right"
      size="min(28.75rem, 100%)"
      classNames={{ content: classes.painel, header: classes.cabecalho }}
    >
      <Drawer.Overlay />
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title fz="lg" fw={600}>
            Adicionar na lista de espera
          </Drawer.Title>
          <Drawer.CloseButton aria-label="Fechar" />
        </Drawer.Header>
        <FormListaEspera onFechar={onFechar} />
      </Drawer.Content>
    </Drawer.Root>
  )
}

/** Rótulo, campo e só depois a ajuda ou o erro, como no FormField do design system. */
const ORDEM_DO_CAMPO: ('label' | 'input' | 'description' | 'error')[] = ['label', 'input', 'description', 'error']

type Erros = { paciente?: string; geral?: string }

function FormListaEspera({ onFechar }: { onFechar: () => void }) {
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [buscaDebounced] = useDebouncedValue(buscaPaciente, 300)
  const [paciente, setPaciente] = useState<PacienteResumo | null>(null)
  const [medicoId, setMedicoId] = useState<string | null>(null)
  const [antecipar, setAntecipar] = useState(false)
  const [erros, setErros] = useState<Erros>({})

  // Pacientes vêm do arquivo importado: busca no servidor pelo nome, sem cadastro.
  const pacientes = useQuery({
    queryKey: ['pacientes', { busca: buscaDebounced, pagina: 1, porPagina: 20 }],
    queryFn: () => fetchPacientes({ busca: buscaDebounced, pagina: 1, porPagina: 20 }),
    enabled: buscaDebounced.trim().length > 0,
  })
  const medicos = useQuery({
    queryKey: ['medicos', 'todos'],
    queryFn: () => fetchMedicos({ busca: '', pagina: 1, porPagina: 100 }),
  })

  // O paciente escolhido continua na lista mesmo quando a busca muda.
  const opcoesPaciente = (pacientes.data?.itens ?? []).map((p) => ({ value: p.id, label: p.nome }))
  if (paciente && !opcoesPaciente.some((o) => o.value === paciente.id)) {
    opcoesPaciente.unshift({ value: paciente.id, label: paciente.nome })
  }

  const queryClient = useQueryClient()
  const criar = useMutation({
    mutationFn: criarPessoaEspera,
    onSuccess: (pessoa) => {
      void queryClient.invalidateQueries({ queryKey: ['lista-espera'] })
      avisarSucesso('Adicionado na lista de espera', `${pessoa.nome} entrou na lista de espera.`)
      onFechar()
    },
    onError: (erro) => setErros({ geral: erro.message }),
  })

  function adicionar() {
    if (!paciente) return
    // A lista de espera avisa por WhatsApp: sem telefone cadastrado, não dá para entrar.
    if (!paciente.telefone) {
      setErros({ paciente: 'Este paciente não tem telefone cadastrado.' })
      return
    }
    setErros({})
    criar.mutate({ nome: paciente.nome, telefone: paciente.telefone, medicoId, antecipar })
  }

  return (
    <>
      <form
        className={classes.corpo}
        onSubmit={(e) => {
          e.preventDefault()
          adicionar()
        }}
        id="form-lista-espera"
      >
        {erros.geral && (
          <Alert color="red" title="Não foi possível adicionar">
            {erros.geral}
          </Alert>
        )}

        <div className={classes.campo}>
          <Select
            label="Paciente"
            inputWrapperOrder={ORDEM_DO_CAMPO}
            placeholder="Buscar pelo nome"
            searchable
            searchValue={buscaPaciente}
            onSearchChange={setBuscaPaciente}
            // A busca já vem filtrada do servidor (sem diferenciar maiúsculas e acentos).
            filter={({ options }) => options}
            data={opcoesPaciente}
            value={paciente?.id ?? null}
            onChange={(id) => {
              setPaciente(pacientes.data?.itens.find((p) => p.id === id) ?? null)
              setErros({})
            }}
            leftSection={<Search size={16} strokeWidth={1.75} />}
            rightSection={pacientes.isFetching ? <Loader size="xs" /> : undefined}
            nothingFoundMessage={
              buscaDebounced.trim() && pacientes.isSuccess ? 'Nenhum paciente encontrado' : undefined
            }
            description={paciente ? undefined : 'Pacientes vêm do arquivo importado.'}
            error={erros.paciente}
            clearable
          />
          {paciente && (
            <div className={classes.paciente}>
              <div>
                <strong>{paciente.nome}</strong>
                <span>{paciente.telefone ? formatTelefone(paciente.telefone) : 'Sem telefone'}</span>
              </div>
            </div>
          )}
        </div>

        <Select
          label="Médico"
          inputWrapperOrder={ORDEM_DO_CAMPO}
          placeholder="Qualquer médico"
          data={(medicos.data?.itens ?? []).map((m) => ({ value: m.id, label: `${m.nome} — ${m.especialidade}` }))}
          value={medicoId}
          onChange={setMedicoId}
          description="Deixe em branco se a pessoa aceita qualquer médico."
          clearable
        />
        <Switch
          label="Quer antecipar uma consulta que já tem"
          description="Apenas informativo: não muda nenhuma regra do sistema."
          checked={antecipar}
          onChange={(e) => setAntecipar(e.currentTarget.checked)}
        />
      </form>

      <Group justify="flex-end" gap="xs" className={classes.rodape}>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="filled" type="submit" form="form-lista-espera" disabled={!paciente} loading={criar.isPending}>
          Adicionar
        </Button>
      </Group>
    </>
  )
}

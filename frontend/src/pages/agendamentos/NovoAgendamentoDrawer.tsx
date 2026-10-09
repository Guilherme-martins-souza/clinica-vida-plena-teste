import {
  Alert,
  Button,
  Drawer,
  Group,
  Input,
  Loader,
  SegmentedControl,
  Select,
  SimpleGrid,
  Text,
  Tooltip,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useDebouncedValue } from '@mantine/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Calendar, Search } from 'lucide-react'
import { useState } from 'react'
import { criarConsulta, fetchHorarios } from '../../api/consultas'
import { ApiError } from '../../api/http'
import { fetchMedicos } from '../../api/medicos'
import { fetchPacientes, type PacienteResumo } from '../../api/pacientes'
import type { TipoAtendimento } from '../../api/types'
import { avisarSucesso } from '../../components/avisos'
import { formatDate, formatDateTime, formatTelefone } from '../../lib/format'
import { fromDataIso, toDataIso } from '../../lib/periodo'
import { SlotPicker } from './SlotPicker'
import classes from './NovoAgendamentoDrawer.module.css'

type NovoAgendamentoDrawerProps = {
  aberto: boolean
  onFechar: () => void
}

/**
 * Painel lateral "Novo agendamento". Esc, o X, o fundo e "Cancelar" fecham sem salvar.
 * O formulário fica num componente à parte: o Drawer o desmonta ao fechar, então ele sempre abre vazio.
 */
export function NovoAgendamentoDrawer({ aberto, onFechar }: NovoAgendamentoDrawerProps) {
  return (
    <Drawer.Root
      opened={aberto}
      onClose={onFechar}
      position="right"
      size="min(28.75rem, 100%)"
      // classNames (e não className no Drawer.Content), que o Mantine também aplicaria ao contêiner de fora.
      classNames={{ content: classes.painel, header: classes.cabecalho }}
    >
      <Drawer.Overlay />
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title fz="lg" fw={600}>
            Novo agendamento
          </Drawer.Title>
          <Drawer.CloseButton aria-label="Fechar" />
        </Drawer.Header>
        <FormNovoAgendamento onFechar={onFechar} />
      </Drawer.Content>
    </Drawer.Root>
  )
}

/** Em qual campo mostrar cada erro da API; o que não está aqui vira um aviso no topo do formulário. */
const CAMPO_DO_ERRO: Record<string, 'paciente' | 'medico' | 'horario'> = {
  PACIENTE_NAO_ENCONTRADO: 'paciente',
  MEDICO_NAO_ENCONTRADO: 'medico',
  HORARIO_OCUPADO: 'horario',
  FORA_DA_GRADE: 'horario',
  FORA_DO_SLOT: 'horario',
  HORARIO_PASSADO: 'horario',
}

/** Rótulo, campo e só depois a ajuda ou o erro, como no FormField do design system. */
const ORDEM_DO_CAMPO: ('label' | 'input' | 'description' | 'error')[] = ['label', 'input', 'description', 'error']

type Erros = { paciente?: string; medico?: string; horario?: string; geral?: string }

function FormNovoAgendamento({ onFechar }: { onFechar: () => void }) {
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [buscaDebounced] = useDebouncedValue(buscaPaciente, 300)
  const [paciente, setPaciente] = useState<PacienteResumo | null>(null)
  const [medicoId, setMedicoId] = useState<string | null>(null)
  const [data, setData] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoAtendimento>('convenio')
  const [horario, setHorario] = useState<string | null>(null)
  const [erros, setErros] = useState<Erros>({})
  // Hoje (AAAA-MM-DD), lido uma vez ao abrir o painel: o calendário não deixa escolher dias passados.
  const [hoje] = useState(() => toDataIso(new Date()))

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
  // O horário depende de médico e data: só busca a grade com os dois escolhidos.
  const horarios = useQuery({
    queryKey: ['horarios', medicoId, data],
    queryFn: () => fetchHorarios(medicoId ?? '', data ?? ''),
    enabled: medicoId !== null && data !== null,
  })

  const medico = medicos.data?.itens.find((m) => m.id === medicoId) ?? null
  // O paciente escolhido continua na lista mesmo quando a busca muda.
  const opcoesPaciente = (pacientes.data?.itens ?? []).map((p) => ({ value: p.id, label: p.nome }))
  if (paciente && !opcoesPaciente.some((o) => o.value === paciente.id)) {
    opcoesPaciente.unshift({ value: paciente.id, label: paciente.nome })
  }

  const queryClient = useQueryClient()
  const criar = useMutation({
    mutationFn: criarConsulta,
    onSuccess: (consulta) => {
      // Lista e contagens, grade do médico e "1ª consulta" dos pacientes mudam com a consulta nova.
      void queryClient.invalidateQueries({ queryKey: ['consultas'] })
      void queryClient.invalidateQueries({ queryKey: ['horarios'] })
      void queryClient.invalidateQueries({ queryKey: ['pacientes'] })
      avisarSucesso(
        'Consulta agendada',
        `${paciente?.nome ?? 'Paciente'} com ${medico?.nome ?? 'o médico'} em ${formatDateTime(consulta.inicio)}.`,
      )
      onFechar()
    },
    onError: (erro) => {
      // Conflitos que só o servidor conhece voltam como erro no campo; o painel continua aberto.
      const campo = erro instanceof ApiError ? CAMPO_DO_ERRO[erro.code] : undefined
      setErros(campo ? { [campo]: erro.message } : { geral: erro.message })
    },
  })

  function agendar() {
    if (!paciente || !medicoId || !horario) return
    setErros({})
    criar.mutate({ pacienteId: paciente.id, medicoId, tipoAtendimento: tipo, inicio: horario })
  }

  // Trocar médico ou data muda a grade: o horário escolhido deixa de valer.
  function trocarGrade(novoMedico: string | null, novaData: string | null) {
    setMedicoId(novoMedico)
    setData(novaData)
    setHorario(null)
    setErros({})
  }

  const completo = paciente !== null && medicoId !== null && data !== null && horario !== null
  const faltando = [
    paciente === null && 'paciente',
    medicoId === null && 'médico',
    data === null && 'data',
    horario === null && 'horário',
  ].filter((campo) => campo !== false)
  const livres = horarios.data?.slots.filter((s) => s.situacao === 'livre').length ?? 0

  return (
    <>
      <form
        className={classes.corpo}
        onSubmit={(e) => {
          e.preventDefault()
          agendar()
        }}
        id="form-novo-agendamento"
      >
        {erros.geral && (
          <Alert color="red" title="Não foi possível agendar">
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
              const escolhido = pacientes.data?.itens.find((p) => p.id === id) ?? null
              setPaciente(escolhido)
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
              {paciente.primeiraConsulta && <span className={classes.etiqueta}>1ª consulta</span>}
            </div>
          )}
        </div>

        <Select
          label="Médico"
          inputWrapperOrder={ORDEM_DO_CAMPO}
          placeholder="Escolha o médico"
          data={(medicos.data?.itens ?? []).map((m) => ({ value: m.id, label: `${m.nome} — ${m.especialidade}` }))}
          value={medicoId}
          onChange={(id) => trocarGrade(id, data)}
          description="A grade de horários vem de medicos.json."
          error={erros.medico}
        />

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <DatePickerInput
            label="Data"
            inputWrapperOrder={ORDEM_DO_CAMPO}
            placeholder="dd/mm/aaaa"
            valueFormat="DD/MM/YYYY"
            leftSection={<Calendar size={16} strokeWidth={1.75} />}
            minDate={hoje}
            value={data}
            onChange={(novaData) => trocarGrade(medicoId, novaData)}
            description={data ? primeiraMaiuscula(dayjs(data).locale('pt-br').format('dddd')) : undefined}
          />
          <Input.Wrapper label="Tipo de atendimento" labelElement="div">
            <SegmentedControl
              fullWidth
              aria-label="Tipo de atendimento"
              data={[
                { value: 'convenio', label: 'Convênio' },
                { value: 'particular', label: 'Particular' },
              ]}
              value={tipo}
              onChange={(v) => setTipo(v === 'particular' ? 'particular' : 'convenio')}
            />
          </Input.Wrapper>
        </SimpleGrid>

        {/* O horário vem da grade do médico: só aparece depois de médico e data. */}
        {medico && data && (
          <Input.Wrapper
            label="Horário"
            labelElement="div"
            description={`Grade de ${medico.nome} em ${formatDate(fromDataIso(data) ?? new Date(data))} · consultas de 30 min · ${livres} ${livres === 1 ? 'livre' : 'livres'}`}
            error={erros.horario}
            errorProps={{ id: 'erro-horario' }}
          >
            <div className={classes.slots}>
              {horarios.isPending && <Loader size="sm" />}
              {horarios.isError && (
                <Text fz="sm" c="var(--danger)">
                  {horarios.error.message}
                </Text>
              )}
              {horarios.isSuccess && (
                <SlotPicker
                  slots={horarios.data.slots}
                  selecionado={horario}
                  onSelect={(inicio) => {
                    setHorario(inicio)
                    setErros({})
                  }}
                  proximoDiaComVaga={horarios.data.proximoDiaComVaga}
                  onIrPara={(dia) => trocarGrade(medicoId, dia)}
                  erroId={erros.horario ? 'erro-horario' : undefined}
                />
              )}
            </div>
          </Input.Wrapper>
        )}
      </form>

      <Group justify="flex-end" gap="xs" className={classes.rodape}>
        <Button onClick={onFechar}>Cancelar</Button>
        <Tooltip label={`Falta escolher: ${faltando.join(', ')}.`} disabled={completo} withArrow>
          <span>
            <Button
              variant="filled"
              type="submit"
              form="form-novo-agendamento"
              disabled={!completo}
              loading={criar.isPending}
            >
              Agendar consulta
            </Button>
          </span>
        </Tooltip>
      </Group>
    </>
  )
}

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

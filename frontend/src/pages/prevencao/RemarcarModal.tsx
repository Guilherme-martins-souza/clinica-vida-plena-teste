import { Alert, Button, Group, Loader, Modal, Radio, Stack, Text } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listarEspera } from '../../api/lista-espera'
import type { ConsultaPrevencao } from '../../api/prevencao'
import { Paginacao } from '../../components/Paginacao'
import { formatDate, formatTelefone, formatTime } from '../../lib/format'

const POR_PAGINA = 5

type RemarcarModalProps = {
  /** Consulta que será remarcada; null deixa o modal fechado. */
  consulta: ConsultaPrevencao | null
  carregando: boolean
  onClose: () => void
  /** Chamado com o id da pessoa escolhida da lista de espera. */
  onConfirmar: (listaEsperaId: string) => void
}

/** Modal do "Remarcar": a recepção escolhe, na lista de espera do médico, quem vai receber o horário no WhatsApp. */
export function RemarcarModal({ consulta, carregando, onClose, onConfirmar }: RemarcarModalProps) {
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)

  const medicoId = consulta?.medico.id ?? null
  const espera = useQuery({
    queryKey: ['lista-espera', medicoId, pagina],
    queryFn: () => listarEspera({ medicoId: medicoId ?? '', pagina, porPagina: POR_PAGINA }),
    enabled: medicoId !== null,
    placeholderData: keepPreviousData,
  })
  const itens = espera.data?.itens ?? []

  function fechar() {
    setEscolhida(null)
    setPagina(1)
    onClose()
  }

  return (
    <Modal opened={consulta !== null} onClose={fechar} title="Remarcar consulta" centered>
      {consulta && (
        <Stack gap="sm">
          <Text>
            Horário liberado: {consulta.medico.nome}, {formatDate(consulta.inicio)} às {formatTime(consulta.inicio)}.
            Escolha quem da lista de espera deste médico receberá o aviso.
          </Text>
          <Alert variant="light" color="blue">
            Ao confirmar, será iniciada uma conversa com a pessoa escolhida por WhatsApp, oferecendo esse horário.
          </Alert>

          {espera.isPending && medicoId !== null && <Loader size="sm" />}
          {espera.isError && (
            <Alert color="red" title="Não foi possível carregar a lista de espera">
              {espera.error.message}
            </Alert>
          )}
          {espera.isSuccess && itens.length === 0 && (
            <Text c="dimmed">Ninguém na lista de espera pediu este médico.</Text>
          )}

          <Radio.Group value={escolhida} onChange={setEscolhida} aria-label="Pessoa da lista de espera">
            <Stack gap="xs">
              {itens.map((pessoa) => (
                <Radio
                  key={pessoa.id}
                  value={pessoa.id}
                  label={pessoa.nome}
                  description={`${formatTelefone(pessoa.telefone)} · na espera desde ${formatDate(pessoa.criadoEm)}${pessoa.antecipar ? ' · quer antecipar' : ''}`}
                />
              ))}
            </Stack>
          </Radio.Group>

          {(espera.data?.total ?? 0) > POR_PAGINA && (
            <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={espera.data?.total ?? 0} onChange={setPagina} />
          )}

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              disabled={escolhida === null}
              loading={carregando}
              onClick={() => escolhida && onConfirmar(escolhida)}
            >
              Confirmar
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

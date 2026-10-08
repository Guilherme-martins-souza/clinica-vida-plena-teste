import { Alert, Card, Group, Select } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { listarPrevencao, type NivelRisco } from '../../api/prevencao'
import tableClasses from '../../components/DataTable.module.css'
import { PageHeader } from '../../components/PageHeader'
import { Paginacao } from '../../components/Paginacao'
import { RISCO_LABELS } from '../../lib/risco'
import { BannerLegenda } from './BannerLegenda'
import { PrevencaoTable } from './PrevencaoTable'

const POR_PAGINA = 10

const NIVEIS: NivelRisco[] = ['media', 'alta', 'muito_alta']
const nivelOptions = NIVEIS.map((nivel) => ({ value: nivel, label: RISCO_LABELS[nivel] }))

function isNivel(value: string | null): value is NivelRisco {
  return NIVEIS.some((nivel) => nivel === value)
}

/** Aba da recepção: consultas dos próximos 14 dias com chance de falta média ou maior, e as ações para evitar a falta. */
export function PrevencaoPage() {
  // Filtro e página ficam na URL (?nivel=alta&pagina=2) para a tela poder ser compartilhada.
  const [searchParams, setSearchParams] = useSearchParams()
  const nivelDaUrl = searchParams.get('nivel')
  const nivel = isNivel(nivelDaUrl) ? nivelDaUrl : null
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1)

  const lista = useQuery({
    queryKey: ['prevencao', 'lista', nivel, pagina],
    queryFn: () => listarPrevencao(nivel, pagina),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  })

  /** Atualiza a URL sem os valores padrão (sem filtro, página 1). */
  function mudarUrl(novoNivel: NivelRisco | null, novaPagina: number) {
    const params = new URLSearchParams()
    if (novoNivel) params.set('nivel', novoNivel)
    if (novaPagina > 1) params.set('pagina', String(novaPagina))
    setSearchParams(params)
  }

  const itens = lista.data?.itens ?? []

  return (
    <>
      <PageHeader
        title="Prevenção de faltas"
        description="Consultas dos próximos 14 dias com chance de falta média ou maior."
      />
      <BannerLegenda />

      <Card component="section" padding={0} className={tableClasses.card}>
        <Group gap="xs" className={tableClasses.toolbar}>
          <Select
            aria-label="Chance de faltar"
            placeholder="Toda chance de faltar"
            data={nivelOptions}
            value={nivel}
            onChange={(v) => mudarUrl(isNivel(v) ? v : null, 1)}
            clearable
            className={tableClasses.select}
          />
        </Group>

        {lista.isError && (
          <Alert color="red" title="Não foi possível carregar a lista" mx="md" mb="md">
            {lista.error.message}
          </Alert>
        )}

        <PrevencaoTable itens={itens} vazia={lista.isSuccess && itens.length === 0} />

        <Paginacao
          pagina={pagina}
          porPagina={POR_PAGINA}
          total={lista.data?.total ?? 0}
          onChange={(nova) => mudarUrl(nivel, nova)}
        />
      </Card>
    </>
  )
}

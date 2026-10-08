import { Button, Group } from '@mantine/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatInteger } from '../lib/format'
import classes from './Paginacao.module.css'

type PaginacaoProps = {
  /** Página atual, a partir de 1. */
  pagina: number
  porPagina: number
  /** Total de linhas da lista inteira (não só da página). */
  total: number
  onChange: (pagina: number) => void
}

/** Rodapé das tabelas paginadas no servidor: "1–10 de 1.480" e os botões Anterior/Próxima. */
export function Paginacao({ pagina, porPagina, total, onChange }: PaginacaoProps) {
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const fim = Math.min(pagina * porPagina, total)

  return (
    <Group justify="space-between" gap="sm" className={classes.foot}>
      <span className={classes.num}>
        {formatInteger(inicio)}–{formatInteger(fim)} de {formatInteger(total)}
      </span>
      <Group gap="xs">
        <Button
          leftSection={<ChevronLeft size={16} strokeWidth={1.75} />}
          disabled={pagina <= 1}
          onClick={() => onChange(pagina - 1)}
        >
          Anterior
        </Button>
        <Button
          rightSection={<ChevronRight size={16} strokeWidth={1.75} />}
          disabled={fim >= total}
          onClick={() => onChange(pagina + 1)}
        >
          Próxima
        </Button>
      </Group>
    </Group>
  )
}

import { Button, Menu } from '@mantine/core'
import { ChevronDown } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { AgendamentoStatus } from '../../api/types'
import { STATUS_LABELS } from '../../lib/status'
import { ACAO_LABELS, opcoesDeStatus } from '../../lib/transicoes'
import classes from './StatusMenu.module.css'

/** Cor do ponto de cada ação, a mesma do selo do status. */
const COR_DO_PONTO: Record<AgendamentoStatus, string> = {
  agendada: 'var(--ink-muted)',
  confirmada: 'var(--info)',
  realizada: 'var(--brand)',
  falta: 'var(--danger)',
  cancelada_paciente: 'var(--warning)',
  cancelada_clinica: 'var(--ink-muted)',
}

type StatusMenuProps = {
  status: AgendamentoStatus
  inicio: Date
  /** Enquanto a troca está sendo gravada, o botão fica em carregamento. */
  carregando: boolean
  onChange: (novo: AgendamentoStatus) => void
}

/**
 * Botão "Alterar status" com o menu das transições da consulta.
 * As que não valem agora aparecem desabilitadas com o motivo. O "agora" é o relógio do navegador;
 * se ele estiver errado, o servidor recusa e a tela mostra o aviso de erro.
 * O Menu do Mantine abre num portal (não é cortado pela tabela) e já cuida do teclado.
 */
export function StatusMenu({ status, inicio, carregando, onChange }: StatusMenuProps) {
  // "Agora" é lido quando o menu abre, para os motivos valerem para aquele momento.
  const [agora, setAgora] = useState(() => new Date())
  const opcoes = opcoesDeStatus(status, inicio, agora)

  return (
    <Menu
      position="bottom-end"
      width="18rem"
      shadow="md"
      withinPortal
      classNames={{ item: classes.item }}
      onOpen={() => setAgora(new Date())}
    >
      <Menu.Target>
        <Button size="xs" rightSection={<ChevronDown size={16} strokeWidth={1.75} />} loading={carregando}>
          Alterar status
        </Button>
      </Menu.Target>
      <Menu.Dropdown aria-label="Alterar status">
        <Menu.Label>Status atual: {STATUS_LABELS[status]}</Menu.Label>
        {opcoes.map((opcao, i) => (
          <Fragment key={opcao.status}>
            {/* Divisor entre comparecimento e cancelamento. */}
            {opcao.grupo === 'cancelamento' && opcoes[i - 1]?.grupo !== 'cancelamento' && <Menu.Divider />}
            <Menu.Item
              disabled={opcao.motivo !== null}
              onClick={() => onChange(opcao.status)}
              leftSection={
                // Desabilitada: ponto vazado (CSS); habilitada: ponto cheio na cor do status.
                <span
                  className={classes.ponto}
                  style={
                    opcao.motivo === null ? { background: COR_DO_PONTO[opcao.status], boxShadow: 'none' } : undefined
                  }
                  aria-hidden="true"
                />
              }
            >
              {ACAO_LABELS[opcao.status]}
              {opcao.motivo && <small className={classes.motivo}>{opcao.motivo}</small>}
            </Menu.Item>
          </Fragment>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

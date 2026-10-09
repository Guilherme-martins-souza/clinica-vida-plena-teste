import { Card, Collapse, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Info } from 'lucide-react'
import { useState } from 'react'
import { buscarRegras } from '../../api/prevencao'
import { FaltosoChip } from '../../components/FaltosoChip'
import { RiscoChip } from '../../components/RiscoChip'
import classes from './BannerLegenda.module.css'

/** Banner no topo da aba, fechado por padrão: explica os chips e a conta do risco com os pesos que a API usa. */
export function BannerLegenda() {
  const [aberto, setAberto] = useState(false)
  const regras = useQuery({ queryKey: ['prevencao', 'regras'], queryFn: buscarRegras })

  return (
    <Card component="section" padding={0}>
      <button
        type="button"
        className={classes.botao}
        aria-expanded={aberto}
        aria-controls="legenda-prevencao"
        onClick={() => setAberto((valor) => !valor)}
      >
        <Info size={20} strokeWidth={1.75} className={classes.icone} aria-hidden="true" />
        <span className={classes.titulo}>Como ler esta lista</span>
        <ChevronDown
          size={20}
          strokeWidth={1.75}
          className={classes.seta}
          data-aberto={aberto || undefined}
          aria-hidden="true"
        />
      </button>

      <Collapse expanded={aberto} id="legenda-prevencao">
        <div className={classes.conteudo}>
          <Text>
            A lista mostra as consultas agendadas ou confirmadas de hoje até 14 dias à frente com chance de falta média
            ou maior, da mais próxima para a mais distante.
          </Text>

          <h3 className={classes.subtitulo}>Chips</h3>
          <ul className={classes.lista}>
            <li>
              <FaltosoChip /> paciente com 25% ou mais de faltas nos 5 últimos atendimentos.
            </li>
            {regras.data && (
              <>
                <li>
                  Risco de faltar <RiscoChip nivel="media" /> a partir de {regras.data.cortes.media} pontos.
                </li>
                <li>
                  Risco de faltar <RiscoChip nivel="alta" /> a partir de {regras.data.cortes.alta} pontos.
                </li>
                <li>
                  Risco de faltar <RiscoChip nivel="muito_alta" /> a partir de {regras.data.cortes.muitoAlta} pontos.
                </li>
              </>
            )}
          </ul>

          <h3 className={classes.subtitulo}>Como o risco é calculado</h3>
          {regras.isError && <Text c="dimmed">Não foi possível carregar a conta do risco.</Text>}
          {regras.data && (
            <>
              <Text>
                Cada fator que vale para a consulta soma pontos; abaixo de {regras.data.cortes.media} o risco é baixo e
                a consulta não aparece.
              </Text>
              <ul className={classes.lista}>
                {regras.data.fatores.map((fator) => (
                  <li key={fator.codigo}>
                    <span className={classes.pontos}>+{fator.pontos}</span> {fator.rotulo}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Collapse>
    </Card>
  )
}

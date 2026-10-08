import { Card, Text } from '@mantine/core'
import { Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import classes from './AvisoCard.module.css'

type AvisoCardProps = {
  /** "atencao" pede uma conferência (ícone de alerta); "info" só orienta (ícone de informação). */
  tom: 'atencao' | 'info'
  children: ReactNode
}

/** Cartão com um ícone e uma frase curta, para avisos dentro da página. */
export function AvisoCard({ tom, children }: AvisoCardProps) {
  const Icone = tom === 'atencao' ? TriangleAlert : Info

  return (
    <Card component="section">
      <div className={classes.aviso}>
        <Icone size={20} strokeWidth={1.75} className={classes[tom]} aria-hidden="true" />
        <Text>{children}</Text>
      </div>
    </Card>
  )
}

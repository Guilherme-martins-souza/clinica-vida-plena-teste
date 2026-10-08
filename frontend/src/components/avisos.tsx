import { notifications } from '@mantine/notifications'
import { Check, CircleAlert } from 'lucide-react'
import classes from './Avisos.module.css'

// Avisos (toasts) depois de uma ação, no canto inferior direito.
// Sucesso some sozinho em cerca de 3 s; erro fica até a pessoa fechar.

/** Aviso de que deu certo, ex.: "Consulta agendada". */
export function avisarSucesso(titulo: string, texto: string) {
  notifications.show({
    title: titulo,
    message: texto,
    icon: <Check size={16} strokeWidth={2} />,
    autoClose: 3000,
    role: 'status', // lido pelo leitor de tela sem interromper
    classNames: { root: classes.root, icon: classes.icone, description: classes.texto },
  })
}

/** Aviso de erro com a mensagem da API. */
export function avisarErro(titulo: string, texto: string) {
  notifications.show({
    title: titulo,
    message: texto,
    icon: <CircleAlert size={16} strokeWidth={2} />,
    autoClose: false,
    role: 'alert',
    classNames: { root: classes.root, icon: classes.iconeErro, description: classes.texto },
  })
}

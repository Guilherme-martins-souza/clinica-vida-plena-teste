import { Calendar, SlidersHorizontal, type LucideIcon } from 'lucide-react'

export type NavItem = { label: string; to: string }
export type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] }

// Árvore do menu lateral. Um nível de submenu, no máximo.
export const navGroups: NavGroup[] = [
  {
    label: 'Agendamentos',
    icon: Calendar,
    items: [
      { label: 'Indicadores', to: '/indicadores' },
      { label: 'Prevenção de Faltas', to: '/prevencao-de-faltas' },
      { label: 'Agendamentos', to: '/agendamentos' },
      { label: 'Lista de espera', to: '/lista-de-espera' },
    ],
  },
  {
    label: 'Parametrizações',
    icon: SlidersHorizontal,
    items: [
      { label: 'Médicos', to: '/medicos' },
      { label: 'Pacientes', to: '/pacientes' },
      { label: 'Importações', to: '/importacoes' },
    ],
  },
]

/** Grupo e item do menu que correspondem à rota atual, para a trilha e o destaque do menu. */
export function findActiveNav(pathname: string): { group: NavGroup; item: NavItem } | undefined {
  for (const group of navGroups) {
    const item = group.items.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
    if (item) return { group, item }
  }
  return undefined
}

import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  NavLink,
  Text,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useLocalStorage, useMediaQuery } from '@mantine/hooks'
import { ChevronDown, Moon, PanelLeft, Sun } from 'lucide-react'
import { useState } from 'react'
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { findActiveNav, navGroups, type NavGroup } from './navigation'
import classes from './AppShellLayout.module.css'
import logoExpandida from '../assets/logo-expandida.png'
import logoMinimizada from '../assets/logo-minimizada.png'

const ICON_SIZE = 20
const ICON_STROKE = 1.75

/**
 * Layout padrão de todas as telas: menu lateral (expandido ou só com ícones), barra superior
 * com o botão de contrair e a trilha de navegação, e a área de conteúdo (<Outlet />).
 */
export function AppShellLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = findActiveNav(location.pathname)

  // Preferência de quem usa, guardada no navegador.
  const [collapsedByUser, setCollapsedByUser] = useLocalStorage({ key: 'vp-menu-contraido', defaultValue: false })
  // Abaixo de 720px o menu fica sempre só com ícones.
  const isNarrow = useMediaQuery('(max-width: 45em)') ?? false
  const collapsed = collapsedByUser || isNarrow

  // Grupos abertos no menu expandido; todos começam abertos.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const isGroupOpen = (group: NavGroup) => openGroups[group.label] ?? true

  function handleCollapsedGroupClick(group: NavGroup) {
    if (isNarrow) {
      // Sem espaço para expandir: vai direto para o primeiro item do grupo.
      navigate(group.items[0].to)
      return
    }
    setCollapsedByUser(false)
    setOpenGroups((prev) => ({ ...prev, [group.label]: true }))
  }

  return (
    <AppShell
      layout="alt"
      header={{ height: 56 }}
      navbar={{ width: collapsed ? 64 : 248, breakpoint: 0 }}
      transitionDuration={180}
      className={classes.shell}
    >
      <AppShell.Navbar className={classes.navbar} data-collapsed={collapsed}>
        <div className={classes.brand}>
          {collapsed ? (
            <img src={logoMinimizada} alt="Vida Plena" className={classes.logo} />
          ) : (
            <img src={logoExpandida} alt="Vida Plena" className={classes.logo} />
          )}
        </div>

        <nav aria-label="Principal" className={classes.nav}>
          {navGroups.map((group) => {
            const Icon = group.icon
            const groupIsActive = active?.group === group

            if (collapsed) {
              return (
                <Tooltip key={group.label} label={group.label} position="right" withArrow>
                  <UnstyledButton
                    className={classes.collapsedGroup}
                    data-active={groupIsActive || undefined}
                    aria-label={group.label}
                    onClick={() => handleCollapsedGroupClick(group)}
                  >
                    <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                  </UnstyledButton>
                </Tooltip>
              )
            }

            return (
              <NavLink
                key={group.label}
                component="button"
                type="button"
                label={group.label}
                leftSection={<Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
                rightSection={<ChevronDown size={16} strokeWidth={ICON_STROKE} className={classes.chevron} />}
                disableRightSectionRotation
                opened={isGroupOpen(group)}
                aria-expanded={isGroupOpen(group)}
                onChange={(opened) => setOpenGroups((prev) => ({ ...prev, [group.label]: opened }))}
                childrenOffset={30}
                classNames={{ root: classes.group, label: classes.groupLabel }}
              >
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    component={RouterNavLink}
                    to={item.to}
                    label={item.label}
                    active={active?.item === item}
                    aria-current={active?.item === item ? 'page' : undefined}
                    className={classes.item}
                  />
                ))}
              </NavLink>
            )
          })}
        </nav>
      </AppShell.Navbar>

      <AppShell.Header className={classes.header}>
        <Group gap="sm" wrap="nowrap" h="100%" px="md" className={classes.headerInner}>
          {!isNarrow && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label="Contrair ou expandir o menu"
              aria-expanded={!collapsed}
              onClick={() => setCollapsedByUser((c) => !c)}
              className={classes.iconButton}
            >
              <PanelLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ActionIcon>
          )}

          {active && (
            <Box component="nav" aria-label="Você está em" className={classes.crumbs}>
              <span>{active.group.label}</span>
              <span aria-hidden="true">/</span>
              <Text span fw={600} c="var(--ink)" aria-current="page">
                {active.item.label}
              </Text>
            </Box>
          )}

          <ThemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Main className={classes.main}>
        <div className={classes.content}>
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  )
}

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const scheme = useComputedColorScheme('light')
  const isDark = scheme === 'dark'

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="lg"
      ml="auto"
      aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      className={classes.iconButton}
    >
      {isDark ? (
        <Sun size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      ) : (
        <Moon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      )}
    </ActionIcon>
  )
}

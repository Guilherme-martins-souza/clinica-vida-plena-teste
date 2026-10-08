import '@fontsource-variable/figtree'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import './theme/tokens.css'
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'dayjs/locale/pt-br'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { cssVariablesResolver, theme } from './theme/theme'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
      {/* Seletores de data em português (nomes de mês e dia, semana começando no domingo).
          Sem destaque de fim de semana: o vermelho fica só para falta e erro, como pede o design system. */}
      <DatesProvider settings={{ locale: 'pt-br', firstDayOfWeek: 0, weekendDays: [] }}>
        {/* Avisos (toasts) do Mantine no canto inferior direito. */}
        <Notifications position="bottom-right" />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
)

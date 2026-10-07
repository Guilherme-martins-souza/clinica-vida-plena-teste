import { createBrowserRouter, Navigate } from 'react-router'
import { AppShellLayout } from './layout/AppShellLayout'
import { ImportacoesPage, MedicosPage } from './pages/em-construcao/EmConstrucaoPage'
import { IndicadoresPage } from './pages/indicadores/IndicadoresPage'

// Todas as telas ficam dentro do AppShellLayout, que renderiza a rota filha no <Outlet />.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShellLayout />,
    children: [
      { index: true, element: <Navigate to="/indicadores" replace /> },
      { path: 'indicadores', element: <IndicadoresPage /> },
      { path: 'medicos', element: <MedicosPage /> },
      { path: 'importacoes', element: <ImportacoesPage /> },
      { path: '*', element: <Navigate to="/indicadores" replace /> },
    ],
  },
])

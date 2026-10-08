import { createBrowserRouter, Navigate } from 'react-router'
import { AppShellLayout } from './layout/AppShellLayout'
import { ImportacaoDetalhePage } from './pages/importacoes/ImportacaoDetalhePage'
import { ImportacoesPage } from './pages/importacoes/ImportacoesPage'
import { IndicadoresPage } from './pages/indicadores/IndicadoresPage'
import { MedicosPage } from './pages/medicos/MedicosPage'
import { PacientesPage } from './pages/pacientes/PacientesPage'

// Todas as telas ficam dentro do AppShellLayout, que renderiza a rota filha no <Outlet />.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShellLayout />,
    children: [
      { index: true, element: <Navigate to="/indicadores" replace /> },
      { path: 'indicadores', element: <IndicadoresPage /> },
      { path: 'medicos', element: <MedicosPage /> },
      { path: 'pacientes', element: <PacientesPage /> },
      { path: 'importacoes', element: <ImportacoesPage /> },
      { path: 'importacoes/:id', element: <ImportacaoDetalhePage /> },
      { path: '*', element: <Navigate to="/indicadores" replace /> },
    ],
  },
])

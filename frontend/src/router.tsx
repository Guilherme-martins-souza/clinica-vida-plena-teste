import { createBrowserRouter, Navigate } from 'react-router'
import { AppShellLayout } from './layout/AppShellLayout'
import { AgendamentosPage } from './pages/agendamentos/AgendamentosPage'
import { ImportacaoDetalhePage } from './pages/importacoes/ImportacaoDetalhePage'
import { ImportacoesPage } from './pages/importacoes/ImportacoesPage'
import { IndicadoresPage } from './pages/indicadores/IndicadoresPage'
import { ListaEsperaPage } from './pages/lista-espera/ListaEsperaPage'
import { MedicosPage } from './pages/medicos/MedicosPage'
import { PacientesPage } from './pages/pacientes/PacientesPage'
import { PrevencaoPage } from './pages/prevencao/PrevencaoPage'

// Todas as telas ficam dentro do AppShellLayout, que renderiza a rota filha no <Outlet />.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShellLayout />,
    children: [
      { index: true, element: <Navigate to="/indicadores" replace /> },
      { path: 'indicadores', element: <IndicadoresPage /> },
      { path: 'prevencao-de-faltas', element: <PrevencaoPage /> },
      { path: 'agendamentos', element: <AgendamentosPage /> },
      { path: 'lista-de-espera', element: <ListaEsperaPage /> },
      { path: 'medicos', element: <MedicosPage /> },
      { path: 'pacientes', element: <PacientesPage /> },
      { path: 'importacoes', element: <ImportacoesPage /> },
      { path: 'importacoes/:id', element: <ImportacaoDetalhePage /> },
      { path: '*', element: <Navigate to="/indicadores" replace /> },
    ],
  },
])

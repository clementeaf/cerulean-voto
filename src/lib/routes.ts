import { lazy } from 'react'

export interface RouteEntry {
  path: string
  label: string
  desc: string
  component: React.LazyExoticComponent<React.ComponentType>
}

export const routes: RouteEntry[] = [
  { path: '/dashboard', label: 'Panel', desc: 'Resumen de elecciones activas', component: lazy(() => import('../pages/Dashboard')) },
  { path: '/elections', label: 'Elecciones', desc: 'Crear y gestionar elecciones', component: lazy(() => import('../pages/Elections')) },
  { path: '/vote', label: 'Votar', desc: 'Emitir voto en eleccion activa', component: lazy(() => import('../pages/Vote')) },
  { path: '/results', label: 'Resultados', desc: 'Escrutinio y auditoria publica', component: lazy(() => import('../pages/Results')) },
  { path: '/voters', label: 'Padron', desc: 'Registro de votantes habilitados', component: lazy(() => import('../pages/Voters')) },
]

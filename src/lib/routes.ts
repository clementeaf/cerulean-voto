import { lazy } from 'react'

export interface RouteEntry {
  path: string
  label: string
  desc: string
  group: string
  component: React.LazyExoticComponent<React.ComponentType>
}

export const routes: RouteEntry[] = [
  // Votacion
  { path: '/dashboard', label: 'Panel', desc: 'Resumen de elecciones activas', group: 'Votacion', component: lazy(() => import('../pages/Dashboard')) },
  { path: '/elections', label: 'Elecciones', desc: 'Crear y gestionar elecciones', group: 'Votacion', component: lazy(() => import('../pages/Elections')) },
  { path: '/vote', label: 'Votar', desc: 'Emitir voto en eleccion activa', group: 'Votacion', component: lazy(() => import('../pages/Vote')) },
  { path: '/results', label: 'Resultados', desc: 'Escrutinio y auditoria publica', group: 'Votacion', component: lazy(() => import('../pages/Results')) },
  { path: '/voters', label: 'Padron', desc: 'Registro de votantes habilitados', group: 'Votacion', component: lazy(() => import('../pages/Voters')) },
  // Organizacion
  { path: '/scopes', label: 'Estructura', desc: 'Unidades, miembros y permisos', group: 'Organizacion', component: lazy(() => import('../pages/Scopes')) },
  { path: '/assemblies', label: 'Asambleas', desc: 'Asambleas ordinarias y extraordinarias', group: 'Organizacion', component: lazy(() => import('../pages/Assemblies')) },
  { path: '/sessions', label: 'Sesiones', desc: 'Tabla, asistencia y desarrollo', group: 'Organizacion', component: lazy(() => import('../pages/Sessions')) },
  { path: '/actas', label: 'Actas', desc: 'Registro formal de sesiones', group: 'Organizacion', component: lazy(() => import('../pages/Actas')) },
  // Administracion
  { path: '/admin', label: 'Administracion', desc: 'Configuracion y datos', group: 'Administracion', component: lazy(() => import('../pages/Admin')) },
]

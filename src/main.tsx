import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import { routes } from './lib/routes'
import { migrateWalletCache } from './lib/wallet'

// Migrate wallet keys from localStorage → sessionStorage (one-time, clears legacy)
migrateWalletCache()

const Landing = lazy(() => import('./pages/Landing'))
const Setup = lazy(() => import('./pages/Setup'))

const Fallback = <div className="py-12 text-center text-neutral-400">Cargando...</div>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Landing — standalone, no layout */}
        <Route path="/" element={<Suspense fallback={Fallback}><Landing /></Suspense>} />

        {/* Setup wizard — standalone, no layout */}
        <Route path="/setup" element={<Suspense fallback={Fallback}><Setup /></Suspense>} />

        {/* App routes with sidebar layout */}
        <Route element={<Layout />}>
          {routes.map(({ path, component: Page }) => (
            <Route
              key={path}
              path={path}
              element={<Suspense fallback={Fallback}><Page /></Suspense>}
            />
          ))}
          {/* Redirects from removed routes */}
          <Route path="/dashboard" element={<Navigate to="/elections" replace />} />
          <Route path="/vote" element={<Navigate to="/elections" replace />} />
          <Route path="/results" element={<Navigate to="/elections" replace />} />
          <Route path="*" element={<Navigate to="/elections" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

import { useState, type ReactElement } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { routes } from '../lib/routes'

export default function Layout(): ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const currentPage = routes.find((r) =>
    r.path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(r.path),
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {sidebarOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-main-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-neutral-900 tracking-tight">Cerulean Voto</span>
            </NavLink>
            {currentPage && (
              <span className="hidden sm:inline text-xs text-neutral-400 border-l border-neutral-200 pl-3">
                {currentPage.label}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Blockchain + BFT + PQC
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-neutral-200 pt-16 pb-4 px-3
            transform transition-transform duration-200 ease-in-out overflow-y-auto
            lg:static lg:translate-x-0 lg:pt-4
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-3 mb-2">
            Votacion
          </p>
          {routes.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex flex-col px-3 py-2 rounded-xl mb-0.5 transition-all duration-150 ${
                  isActive
                    ? 'bg-main-500 text-white shadow-sm'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span
                    className={`text-[11px] leading-tight mt-0.5 ${
                      isActive ? 'text-white/70' : 'text-neutral-400 group-hover:text-neutral-500'
                    }`}
                  >
                    {item.desc}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-4">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-neutral-400">
          <span>Cerulean Voto</span>
          <span>Voto electronico verificable sobre DLT post-cuantica</span>
        </div>
      </footer>
    </div>
  )
}

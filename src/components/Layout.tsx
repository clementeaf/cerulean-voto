import { useState, useEffect, type ReactElement } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { routes } from '../lib/routes'
import { getActiveScope, getScope, getOrgSettings } from '../lib/store'
import { getAuth, isAuthenticated, authConnect, authDisconnect, authRefreshRole, onAuthChange } from '../lib/auth'
import { getStoredWallets, didFromWallet, signVote, didFromAddress } from '../lib/wallet'

function useAuth() {
  const [, setTick] = useState(0)
  useEffect(() => onAuthChange(() => setTick((t) => t + 1)), [])
  return getAuth()
}

function AuthGate() {
  const wallets = getStoredWallets()
  const [selectedAddress, setSelectedAddress] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  // Check for Cerulean extension
  const [extensionAvailable, setExtensionAvailable] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).cerulean) setExtensionAvailable(true)
    else {
      const h = () => setExtensionAvailable(true)
      window.addEventListener('cerulean#initialized', h)
      return () => window.removeEventListener('cerulean#initialized', h)
    }
  }, [])

  async function handleConnect() {
    setErr('')
    const wallet = wallets.find((w) => w.walletFile.address === selectedAddress)
    if (!wallet) { setErr('Selecciona una wallet'); return }
    if (!passphrase) { setErr('Ingresa la clave de tu wallet'); return }

    setLoading(true)
    try {
      // Verify passphrase by signing a test payload
      await signVote(wallet.walletFile, passphrase, { proposal_id: 0, option: 'auth-verify' })
      const did = didFromWallet(wallet.walletFile)
      authConnect(did, wallet.walletFile.address, wallet.walletFile.public_key)
    } catch {
      setErr('Clave incorrecta — no se pudo descifrar la wallet')
    } finally {
      setLoading(false)
    }
  }

  async function handleExtension() {
    setErr('')
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cerulean = (window as any).cerulean
      if (!cerulean) { setErr('Extension no detectada'); return }
      const { address, publicKey } = await cerulean.connect()
      const did = didFromAddress(address)
      authConnect(did, address, publicKey)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al conectar extension')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="bg-white rounded-xl border border-neutral-200 p-6 w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-main-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-neutral-900">Cerulean Voto</h2>
          <p className="text-sm text-neutral-500 mt-1">Conecta tu wallet para continuar</p>
        </div>

        {extensionAvailable && (
          <button onClick={handleExtension} disabled={loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-neutral-300 transition-colors">
            {loading ? 'Conectando...' : 'Conectar con Extension'}
          </button>
        )}

        {wallets.length > 0 && (
          <>
            {extensionAvailable && <div className="flex items-center gap-2"><div className="flex-1 h-px bg-neutral-200" /><span className="text-xs text-neutral-400">o</span><div className="flex-1 h-px bg-neutral-200" /></div>}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Wallet</label>
              <select className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={selectedAddress} onChange={(e) => setSelectedAddress(e.target.value)}>
                <option value="">Seleccionar...</option>
                {wallets.map((w) => (
                  <option key={w.walletFile.address} value={w.walletFile.address}>
                    {w.name || w.walletFile.address.slice(0, 16) + '...'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Clave</label>
              <input type="password" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Clave de tu wallet"
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()} />
            </div>
            <button onClick={handleConnect} disabled={loading || !selectedAddress || !passphrase}
              className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 disabled:bg-neutral-300 disabled:text-neutral-400 transition-colors">
              {loading ? 'Verificando...' : 'Conectar'}
            </button>
          </>
        )}

        {wallets.length === 0 && !extensionAvailable && (
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-xs text-amber-700">No hay wallets registradas. Ve a <a href="/setup" className="underline font-semibold">/setup</a> para crear tu organizacion.</p>
          </div>
        )}

        {err && <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2">{err}</p>}
      </div>
    </div>
  )
}

export default function Layout(): ReactElement {
  const auth = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Refresh role when active scope changes
  useEffect(() => { if (auth) authRefreshRole() }, [location.pathname])

  if (!isAuthenticated()) {
    return <AuthGate />
  }

  const activeScopeId = getActiveScope()
  const activeScope = activeScopeId ? getScope(activeScopeId) : null
  const org = getOrgSettings()
  const isFounder = !!org.founder_did && org.founder_did === auth!.did

  const currentPage = routes.find((r) =>
    r.path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(r.path),
  )

  return (
    <div className="h-screen flex flex-col overflow-hidden">
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
          <div className="hidden sm:flex items-center gap-3 text-xs text-neutral-400">
            {activeScope && (
              <span className="bg-main-50 text-main-700 px-2 py-0.5 rounded-full font-medium">
                {activeScope.label}: {activeScope.name}
              </span>
            )}
            <div className="flex items-center gap-2 bg-neutral-50 rounded-full px-3 py-1 border border-neutral-100">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="font-mono text-[10px] text-neutral-500">{auth!.address.slice(0, 12)}...</span>
              {isFounder && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">Fundador</span>}
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-medium">{auth!.role}</span>
              <button onClick={authDisconnect} className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors">Salir</button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 max-w-screen-2xl mx-auto w-full">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-neutral-200 pt-16 pb-4 px-3
            transform transition-transform duration-200 ease-in-out overflow-y-auto
            lg:static lg:translate-x-0 lg:pt-4
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {(() => {
            const groups = [...new Set(routes.map((r) => r.group))]
            return groups.map((group) => (
              <div key={group} className="mb-3">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-3 mb-1">
                  {group}
                </p>
                {routes
                  .filter((r) => r.group === group)
                  .map((item) => (
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
              </div>
            ))
          })()}
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-2 shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Cerulean Voto</span>
          <span>DLT post-cuantica</span>
        </div>
      </footer>
    </div>
  )
}

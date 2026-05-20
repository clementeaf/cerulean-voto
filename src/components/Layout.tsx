import { useState, useEffect, type ReactElement } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { routes } from '../lib/routes'
import { getActiveScope, getScope, getOrgSettings } from '../lib/store'
import { getAuth, isAuthenticated, authConnect, authDisconnect, authRefreshRole, onAuthChange } from '../lib/auth'
import { getStoredWallets, didFromWallet, verifyPassphrase, didFromAddress, verifyAddressDerivation } from '../lib/wallet'
import { createQRSession, pollQRSession, type QRSession, isMobileBrowser, getPendingMobileSession, resolveMobileSession, startMobileRedirect } from '../lib/qr-connect'
import { QRCodeSVG } from 'qrcode.react'

function useAuth() {
  const [, setTick] = useState(0)
  useEffect(() => onAuthChange(() => setTick((t) => t + 1)), [])
  return getAuth()
}

function AuthGate() {
  const wallets = getStoredWallets()
  const mobile = isMobileBrowser()
  const [tab, setTab] = useState<'extension' | 'qr' | 'mobile' | 'vault'>(mobile ? 'mobile' : 'qr')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  // QR session state
  const [qrSession, setQrSession] = useState<QRSession | null>(null)
  const [qrPolling, setQrPolling] = useState(false)

  // Check for Cerulean extension
  const [extensionAvailable, setExtensionAvailable] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).cerulean) { setExtensionAvailable(true); setTab('extension') }
    else {
      const h = () => { setExtensionAvailable(true); setTab('extension') }
      window.addEventListener('cerulean#initialized', h)
      return () => window.removeEventListener('cerulean#initialized', h)
    }
  }, [])

  // Handle mobile redirect callback (?session= in URL or sessionStorage)
  useEffect(() => {
    const pendingSession = getPendingMobileSession()
    if (!pendingSession) return

    setLoading(true)
    setTab('mobile')
    resolveMobileSession(pendingSession).then(async (result) => {
      setLoading(false)
      if (!result) { setErr('Sesion expirada o no encontrada. Intenta de nuevo.'); return }
      const valid = await verifyAddressDerivation(result.publicKey, result.address)
      if (!valid) { setErr('Wallet no verificada — clave publica no corresponde a la direccion'); return }
      const did = didFromAddress(result.address)
      authConnect(did, result.address, result.publicKey, 'vault')
    })
  }, [])

  // Generate QR session when QR tab is selected
  useEffect(() => {
    if (tab !== 'qr') return
    const controller = new AbortController()

    createQRSession().then((session) => {
      if (controller.signal.aborted) return
      setQrSession(session)
      setQrPolling(true)

      pollQRSession(session, controller.signal).then(async (result) => {
        setQrPolling(false)
        if (!result) return
        const valid = await verifyAddressDerivation(result.publicKey, result.address)
        if (!valid) { setErr('Wallet no verificada — clave publica no corresponde a la direccion'); return }
        const did = didFromAddress(result.address)
        authConnect(did, result.address, result.publicKey, 'vault')
      })
    })

    return () => { controller.abort(); setQrPolling(false); setQrSession(null) }
  }, [tab])

  async function handleConnect() {
    setErr('')
    const wallet = wallets.find((w) => w.walletFile.address === selectedAddress)
    if (!wallet) { setErr('Selecciona una wallet'); return }
    if (!passphrase) { setErr('Ingresa la clave de tu wallet'); return }

    setLoading(true)
    try {
      await verifyPassphrase(wallet.walletFile, passphrase)
      const did = didFromWallet(wallet.walletFile)
      authConnect(did, wallet.walletFile.address, wallet.walletFile.public_key, 'vault')
    } catch {
      setErr('Clave incorrecta — no se pudo descifrar la wallet')
    } finally {
      setPassphrase('')
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
      const valid = await verifyAddressDerivation(publicKey, address)
      if (!valid) { setErr('Extension no verificada — la clave publica no corresponde a la direccion'); return }
      const did = didFromAddress(address)
      authConnect(did, address, publicKey, 'extension')
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al conectar extension')
    } finally {
      setLoading(false)
    }
  }

  const tabClass = (t: string) => `flex-1 py-2 text-xs font-semibold transition-colors ${tab === t ? 'bg-main-500 text-white' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'}`

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

        {/* Tabs */}
        <div className="flex border border-neutral-200 rounded-lg overflow-hidden">
          {extensionAvailable && (
            <button onClick={() => { setTab('extension'); setErr('') }} className={tabClass('extension')}>Extension</button>
          )}
          {mobile ? (
            <button onClick={() => { setTab('mobile'); setErr('') }} className={tabClass('mobile')}>Conectar</button>
          ) : (
            <button onClick={() => { setTab('qr'); setErr('') }} className={tabClass('qr')}>QR Celular</button>
          )}
          <button onClick={() => { setTab('vault'); setErr('') }} className={tabClass('vault')}>Importar</button>
        </div>

        {/* Extension tab */}
        {tab === 'extension' && (
          <button onClick={handleExtension} disabled={loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-neutral-300 transition-colors">
            {loading ? 'Conectando...' : 'Conectar con Extension'}
          </button>
        )}

        {/* QR tab */}
        {tab === 'qr' && qrSession && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="bg-white border border-neutral-200 rounded-xl p-4">
                <QRCodeSVG value={qrSession.connectUrl} size={180} level="M" bgColor="#ffffff" fgColor="#171717" />
              </div>
            </div>
            <div className="text-center space-y-1">
              {qrPolling ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-main-500 animate-pulse" />
                  <p className="text-xs text-main-600 font-medium">Esperando conexion desde celular...</p>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">Tiempo agotado. Cambia de tab y vuelve para generar nuevo QR.</p>
              )}
              <p className="text-[10px] text-neutral-400">Abre Cerulean Wallet en tu celular y escanea este codigo</p>
            </div>
          </div>
        )}

        {/* Mobile redirect tab */}
        {tab === 'mobile' && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <span className="w-2 h-2 rounded-full bg-main-500 animate-pulse" />
                <p className="text-xs text-main-600 font-medium">Verificando conexion...</p>
              </div>
            ) : (
              <>
                <div className="bg-neutral-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-neutral-600">
                    Se abrira <span className="font-semibold">Cerulean Wallet</span> en este navegador para verificar tu identidad.
                  </p>
                </div>
                <button onClick={() => startMobileRedirect()}
                  className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors">
                  Abrir Cerulean Wallet
                </button>
              </>
            )}
          </div>
        )}

        {/* Vault import tab */}
        {tab === 'vault' && (
          <>
            {wallets.length > 0 ? (
              <>
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
            ) : (
              <div className="bg-neutral-50 rounded-lg p-3 text-center">
                <p className="text-xs text-neutral-500">No hay wallets importadas. Usa el QR para conectar desde el celular o ve a <a href="/setup" className="text-main-600 underline font-semibold">/setup</a> para configurar.</p>
              </div>
            )}
          </>
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

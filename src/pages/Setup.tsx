import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  saveOrgSettings,
  saveScope,
  buildChannelId,
  type OrgSettings,
} from '../lib/store'
import {
  CERULEAN_WALLET_URL,
  importFromVault,
  assignName,
  storeWallet,
  getStoredWallets,
  didFromWallet,
  didFromAddress,
  signVote,
  type StoredWallet,
  type WalletFile,
} from '../lib/wallet'
import { authConnect } from '../lib/auth'
import { createChannel, registerIdentity, submitProposal } from '../lib/api'

const STEPS = [
  { n: 1, label: 'Tu identidad' },
  { n: 2, label: 'Organizacion' },
  { n: 3, label: 'Participantes' },
  { n: 4, label: 'Estructura' },
  { n: 5, label: 'Votacion' },
]

export default function Setup() {
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1: Admin wallet
  const [walletMode, setWalletMode] = useState<'existing' | 'extension' | 'create'>('existing')
  const [extensionAvailable, setExtensionAvailable] = useState(false)
  const [importDid, setImportDid] = useState('')
  const [importPass, setImportPass] = useState('')
  const [adminWallet, setAdminWallet] = useState<WalletFile | null>(null)
  const [adminDid, setAdminDid] = useState('')

  // Step 2: Org
  const [orgName, setOrgName] = useState('')
  const [orgRut, setOrgRut] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [president, setPresident] = useState('')
  const [secretary, setSecretary] = useState('')

  // Step 3: Participants
  const [participants, setParticipants] = useState<StoredWallet[]>(getStoredWallets)
  const [pName, setPName] = useState('')
  const [pPass, setPPass] = useState('')
  const [pMsg, setPMsg] = useState('')

  // Step 4: Structure
  const [scopes, setScopes] = useState<{ name: string; label: string }[]>([])
  const [sName, setSName] = useState('')
  const [sLabel, setSLabel] = useState('Departamento')

  // Step 5: Election
  const [electionTitle, setElectionTitle] = useState('')
  const [electionDesc, setElectionDesc] = useState('')

  // Detect Cerulean Wallet extension
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (w.cerulean) {
      setExtensionAvailable(true)
      setWalletMode('extension')
    } else {
      const handler = () => { setExtensionAvailable(true); setWalletMode('extension') }
      window.addEventListener('cerulean#initialized', handler)
      return () => window.removeEventListener('cerulean#initialized', handler)
    }
  }, [])

  // ── Step 1c: Connect via Chrome extension ──
  async function connectExtension() {
    setErr('')
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cerulean = (window as any).cerulean
      if (!cerulean) { setErr('Extension no detectada'); setLoading(false); return }

      const { address, publicKey } = await cerulean.connect()
      // Verify the extension identity
      const { verifyAddressDerivation } = await import('../lib/wallet')
      const valid = await verifyAddressDerivation(publicKey, address)
      if (!valid) { setErr('Extension no verificada — clave publica no corresponde a la direccion'); setLoading(false); return }
      const did = didFromAddress(address)

      // Register on-chain if not already
      try {
        await registerIdentity({ did, public_key: publicKey })
      } catch { /* may already exist */ }

      // Build a minimal wallet file for local use (signing goes through extension)
      const extWallet: WalletFile = {
        version: 1,
        algorithm: 'ed25519',
        address,
        public_key: publicKey,
        private_key: { type: 'Encrypted', ciphertext: 'extension-managed', salt: '', nonce: '' },
      }
      setAdminWallet(extWallet)
      setAdminDid(did)
      storeWallet('', extWallet)
      authConnect(did, address, publicKey, 'extension')
      setParticipants(getStoredWallets())
      setStep(2)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al conectar extension')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: Import existing wallet ──
  async function importExistingWallet() {
    setErr('')
    if (!importDid.trim()) { setErr('Ingresa tu DID'); return }
    if (!importPass) { setErr('Ingresa la clave de tu wallet'); return }

    setLoading(true)
    try {
      const result = await importFromVault(importDid.trim())
      if (!result?.walletFile) { setErr('Wallet no encontrada en la red'); setLoading(false); return }

      // Verify passphrase by attempting to sign a test payload
      try {
        await signVote(result.walletFile, importPass, { proposal_id: 0, option: 'test' })
      } catch {
        setErr('Clave incorrecta — no se pudo descifrar la wallet')
        setLoading(false)
        return
      }

      setAdminWallet(result.walletFile)
      const did = didFromWallet(result.walletFile)
      setAdminDid(did)
      authConnect(did, result.walletFile.address, result.walletFile.public_key)
      setParticipants(getStoredWallets())
      setStep(2)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Save org ──
  async function saveOrg() {
    setErr('')
    if (!orgName.trim()) { setErr('El nombre es obligatorio'); return }
    if (!president.trim()) { setErr('El presidente es obligatorio'); return }
    if (!secretary.trim()) { setErr('El secretario es obligatorio'); return }

    setLoading(true)
    try {
      const slug = orgName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      let channelId = slug
      try {
        const result = await createChannel(slug)
        channelId = result.channel_id || slug
      } catch { /* channel may already exist */ }

      const settings: OrgSettings = {
        org_name: orgName.trim(),
        rut: orgRut.trim(),
        address: orgAddress.trim(),
        president: president.trim(),
        secretary: secretary.trim(),
        quorum_min_primera: 50,
        quorum_min_segunda: 0,
        channel_id: channelId,
        founder_did: adminDid,
      }
      saveOrgSettings(settings)

      // Assign president name to admin wallet (wallet was created without name)
      if (adminDid) {
        assignName(adminDid, president.trim())
        setParticipants(getStoredWallets())
      }

      setStep(3)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Add participant by address/DID ──
  async function addParticipantByAddress() {
    setErr(''); setPMsg('')
    const input = pName.trim()
    if (!input) { setErr('Ingresa una direccion de wallet'); return }

    // Determine DID and address
    const isDid = input.startsWith('did:cerulean:')
    const address = isDid ? input.replace('did:cerulean:', '') : input
    const did = isDid ? input : `did:cerulean:${address}`
    const label = pPass.trim() // pPass reused as name field

    setLoading(true)
    try {
      // Try to import from vault first (gets the full wallet)
      const imported = await importFromVault(did)
      if (imported) {
        if (label) assignName(did, label)
        setParticipants(getStoredWallets())
        setPMsg(`${label || address.slice(0, 12) + '...'} importado desde la red`)
      } else {
        // Not in vault — register as identity-only participant (no wallet file needed to be in padron)
        const placeholderWallet: WalletFile = {
          version: 1, algorithm: 'ed25519', address, public_key: '',
          private_key: { type: 'Encrypted', ciphertext: '', salt: '', nonce: '' },
        }
        storeWallet(label, placeholderWallet)
        setParticipants(getStoredWallets())
        setPMsg(`${label || address.slice(0, 12) + '...'} inscrito en el padron`)
      }
      setPName(''); setPPass('')
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 4: Add scope ──
  function addScope() {
    if (!sName.trim()) return
    setScopes([...scopes, { name: sName.trim(), label: sLabel.trim() || 'Unidad' }])
    setSName('')
  }

  async function saveScopes() {
    setErr(''); setLoading(true)
    try {
      const org = { channel_id: orgName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }
      for (const s of scopes) {
        const channelId = buildChannelId(org.channel_id, null, s.name)
        try { await createChannel(channelId) } catch { /* ok */ }
        await saveScope({ name: s.name, label: s.label, parent_id: null, channel_id: channelId, members: [] })
      }
      setStep(5)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 5: Create election ──
  async function createElection() {
    setErr('')
    if (!electionTitle.trim()) { setErr('El titulo es obligatorio'); return }

    setLoading(true)
    try {
      await submitProposal({
        proposer: adminDid || `did:cerulean:${orgName.trim().toLowerCase().replace(/\s+/g, '-')}`,
        description: electionTitle.trim(),
        deposit: 10000,
        action: { type: 'text', title: electionTitle.trim(), description: electionDesc.trim() || electionTitle.trim() },
      })
      nav('/dashboard')
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-main-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-neutral-900">Cerulean Voto</span>
          <span className="text-xs text-neutral-400 border-l border-neutral-200 pl-3">Configuracion inicial</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-8">
        {/* Steps */}
        <div className="flex items-center gap-0.5 mb-8 flex-wrap justify-center">
          {STEPS.map((s) => (
            <div key={s.n} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                step > s.n ? 'bg-green-500 text-white' : step === s.n ? 'bg-main-500 text-white' : 'bg-neutral-200 text-neutral-400'
              }`}>
                {step > s.n ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : s.n}
              </div>
              <span className={`text-xs mr-2 ${step === s.n ? 'text-neutral-700 font-medium' : 'text-neutral-400'}`}>{s.label}</span>
              {s.n < 5 && <div className="w-6 h-px bg-neutral-200 mr-0.5" />}
            </div>
          ))}
        </div>

        <div className="w-full max-w-lg">
          {err && <p className="text-xs text-red-700 bg-red-50 rounded-lg p-3 mb-4">{err}</p>}

          {/* ── Step 1: Admin wallet ── */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Tu identidad digital</h2>
                <p className="text-sm text-neutral-500 mt-1">Tu wallet es tu firma criptografica. Si ya tienes una, conectala. Si no, crea una en Cerulean Wallet.</p>
              </div>

              {/* Tabs */}
              <div className="flex border border-neutral-200 rounded-lg overflow-hidden">
                {extensionAvailable && (
                  <button
                    onClick={() => { setWalletMode('extension'); setErr('') }}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${walletMode === 'extension' ? 'bg-main-500 text-white' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'}`}
                  >
                    Extension
                  </button>
                )}
                <button
                  onClick={() => { setWalletMode('existing'); setErr('') }}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${walletMode === 'existing' ? 'bg-main-500 text-white' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'}`}
                >
                  Tengo DID
                </button>
                <button
                  onClick={() => { setWalletMode('create'); setErr('') }}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${walletMode === 'create' ? 'bg-main-500 text-white' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'}`}
                >
                  Crear wallet
                </button>
              </div>

              {walletMode === 'extension' ? (
                <>
                  <div className="bg-green-50 rounded-lg p-4 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-green-800">Cerulean Wallet detectada</p>
                    <p className="text-xs text-green-700">La extension gestionara tu identidad y firmara tus votos.</p>
                  </div>
                  <button onClick={connectExtension} disabled={loading}
                    className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 disabled:bg-neutral-300 transition-colors">
                    {loading ? 'Conectando...' : 'Conectar con Cerulean Wallet'}
                  </button>
                </>
              ) : walletMode === 'existing' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Tu DID o direccion</label>
                    <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm font-mono" value={importDid} onChange={(e) => setImportDid(e.target.value)} placeholder="Direccion hex de la wallet" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Clave de tu wallet</label>
                    <input type="password" className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={importPass} onChange={(e) => setImportPass(e.target.value)} placeholder="La clave con la que cifraste tu wallet" />
                  </div>
                  <button onClick={importExistingWallet} disabled={loading}
                    className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 disabled:bg-neutral-300 transition-colors">
                    {loading ? 'Verificando...' : 'Ingresar con mi wallet'}
                  </button>
                  <p className="text-[10px] text-neutral-400 text-center">
                    Se busca tu wallet en la red Cerulean y se verifica tu clave.
                  </p>
                </>
              ) : (
                <>
                  <div className="bg-main-50 rounded-lg p-4 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-main-100 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-main-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-main-800">Crea tu wallet en Cerulean Wallet</p>
                    <p className="text-xs text-main-700">Tu wallet se crea en la app oficial. Una vez creada, vuelve aqui e importala con tu DID.</p>
                  </div>
                  <a href={CERULEAN_WALLET_URL} target="_blank" rel="noreferrer"
                    className="block w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors text-center">
                    Ir a Cerulean Wallet
                  </a>
                  <p className="text-[10px] text-neutral-400 text-center">
                    Despues de crear tu wallet, vuelve y selecciona "Tengo DID" para importarla.
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Org ── */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Tu organizacion</h2>
                <p className="text-sm text-neutral-500 mt-1">Datos que apareceran en actas y documentos oficiales.</p>
                {adminWallet && (
                  <div className="mt-2 bg-green-50 rounded-lg p-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-xs text-green-700">Wallet activa: <span className="font-mono">{adminDid.slice(0, 35)}...</span></span>
                  </div>
                )}
                <p className="text-[10px] text-neutral-400 mt-1">Tu nombre se asigna como presidente de la organizacion.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre de la organizacion *</label>
                <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ej: Asociacion Vecinal Norte" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">RUT</label>
                  <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={orgRut} onChange={(e) => setOrgRut(e.target.value)} placeholder="76.000.000-0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Direccion</label>
                  <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} placeholder="Av. Principal 123" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Presidente *</label>
                  <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={president} onChange={(e) => setPresident(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Secretario/a *</label>
                  <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={secretary} onChange={(e) => setSecretary(e.target.value)} placeholder="Nombre completo" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 bg-neutral-100 text-neutral-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors">Atras</button>
                <button onClick={saveOrg} disabled={loading}
                  className="flex-1 bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 disabled:bg-neutral-300 transition-colors">
                  {loading ? 'Creando canal DLT...' : 'Continuar'}
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 text-center">Se crea automaticamente un canal DLT aislado para tu organizacion.</p>
            </div>
          )}

          {/* ── Step 3: Participants ── */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Inscribir participantes</h2>
                <p className="text-sm text-neutral-500 mt-1">Agrega las direcciones o DIDs de quienes participaran. Cada persona crea su propia wallet.</p>
              </div>

              {/* Add by address/DID */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Direccion o DID de la wallet</label>
                <div className="flex gap-2">
                  <input className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono" value={pName} onChange={(e) => setPName(e.target.value)}
                    placeholder="Direccion hex de la wallet" />
                  <button onClick={addParticipantByAddress} disabled={loading}
                    className="bg-main-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 disabled:bg-neutral-300 transition-colors shrink-0">
                    {loading ? '...' : 'Agregar'}
                  </button>
                </div>
              </div>

              {/* Optional: label */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre para el padron (opcional)</label>
                <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={pPass} onChange={(e) => setPPass(e.target.value)} placeholder="Ej: Ana Torres" />
              </div>

              {pMsg && <p className="text-xs text-green-700 bg-green-50 rounded p-2">{pMsg}</p>}

              {participants.length > 0 && (
                <div className="border border-neutral-100 rounded-lg divide-y divide-neutral-100">
                  {participants.map((w) => (
                    <div key={w.walletFile.address} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm font-medium flex-1 min-w-0 truncate">{w.name || didFromWallet(w.walletFile).slice(0, 25) + '...'}</span>
                      <span className="text-[10px] font-mono text-neutral-400 shrink-0">{w.walletFile.address.slice(0, 12)}...</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-neutral-400">Cada participante debe haber creado su wallet previamente en Cerulean Wallet o en esta plataforma.</p>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 bg-neutral-100 text-neutral-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors">Atras</button>
                <button onClick={() => setStep(4)}
                  className="flex-1 bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors">
                  Continuar ({participants.length} registrados)
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Structure ── */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Estructura (opcional)</h2>
                <p className="text-sm text-neutral-500 mt-1">Define como se organiza tu institucion. Puedes agregar mas despues.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={sLabel} onChange={(e) => setSLabel(e.target.value)} placeholder="Departamento" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre</label>
                  <div className="flex gap-2">
                    <input className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Ej: Finanzas" onKeyDown={(e) => e.key === 'Enter' && addScope()} />
                    <button onClick={addScope} className="bg-neutral-800 text-white px-3 rounded-lg text-sm hover:bg-neutral-900 transition-colors">+</button>
                  </div>
                </div>
              </div>
              {scopes.length > 0 && (
                <div className="border border-neutral-100 rounded-lg divide-y divide-neutral-100">
                  {scopes.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-[10px] text-neutral-400">{s.label}:</span>
                      <span className="text-sm font-medium flex-1">{s.name}</span>
                      <button onClick={() => setScopes(scopes.filter((_, j) => j !== i))} className="text-[10px] text-neutral-400 hover:text-red-500">Quitar</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-neutral-400">Puedes saltar este paso. La estructura se puede crear y modificar despues.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(3)} className="flex-1 bg-neutral-100 text-neutral-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors">Atras</button>
                <button onClick={() => { if (scopes.length > 0) saveScopes(); else setStep(5) }}
                  className="flex-1 bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors">
                  {scopes.length > 0 ? `Crear ${scopes.length} unidades` : 'Saltar'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: First election ── */}
          {step === 5 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Primera votacion</h2>
                <p className="text-sm text-neutral-500 mt-1">Crea tu primera eleccion. Puedes crear mas despues.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Titulo *</label>
                <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={electionTitle} onChange={(e) => setElectionTitle(e.target.value)} placeholder="Ej: Eleccion de Directorio 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" rows={3} value={electionDesc} onChange={(e) => setElectionDesc(e.target.value)} placeholder="Detalle, reglas, opciones..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(4)} className="flex-1 bg-neutral-100 text-neutral-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors">Atras</button>
                <button onClick={createElection} disabled={loading}
                  className="flex-1 bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 disabled:bg-neutral-300 transition-colors">
                  {loading ? 'Creando...' : 'Crear y empezar'}
                </button>
              </div>
              <button onClick={() => nav('/dashboard')} className="w-full text-xs text-neutral-400 hover:text-neutral-600 text-center py-1">
                Saltar — ir directo al panel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

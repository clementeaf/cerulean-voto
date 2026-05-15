import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  saveOrgSettings,
  saveScope,
  buildChannelId,
  type OrgSettings,
} from '../lib/store'
import {
  createWallet,
  storeWallet,
  getStoredWallets,
  didFromWallet,
  type StoredWallet,
  type WalletFile,
} from '../lib/wallet'
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
  const [adminName, setAdminName] = useState('')
  const [adminPass, setAdminPass] = useState('')
  const [adminPassConfirm, setAdminPassConfirm] = useState('')
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

  // ── Step 1: Create admin wallet ──
  async function createAdminWallet() {
    setErr('')
    if (!adminName.trim()) { setErr('Tu nombre es obligatorio'); return }
    if (adminPass.length < 4) { setErr('La clave debe tener al menos 4 caracteres'); return }
    if (adminPass !== adminPassConfirm) { setErr('Las claves no coinciden'); return }

    setLoading(true)
    try {
      const wallet = await createWallet(adminPass)
      const did = didFromWallet(wallet)
      await registerIdentity({ did, public_key: wallet.public_key, metadata: { voter_name: adminName.trim(), role: 'admin' } })
      storeWallet(adminName.trim(), wallet)
      setAdminWallet(wallet)
      setAdminDid(did)
      setPresident(adminName.trim())
      setParticipants(getStoredWallets())
      setStep(2)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al crear wallet')
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
      }
      saveOrgSettings(settings)
      setStep(3)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Add participant ──
  async function addParticipant() {
    setErr(''); setPMsg('')
    if (!pName.trim()) { setErr('Ingresa un nombre'); return }
    if (pPass.length < 4) { setErr('La clave debe tener al menos 4 caracteres'); return }

    setLoading(true)
    try {
      const walletFile = await createWallet(pPass)
      const did = didFromWallet(walletFile)
      await registerIdentity({ did, public_key: walletFile.public_key, metadata: { voter_name: pName.trim() } })
      storeWallet(pName.trim(), walletFile)
      setParticipants(getStoredWallets())
      setPMsg(`${pName.trim()} registrado`)
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
        saveScope({ name: s.name, label: s.label, parent_id: null, channel_id: channelId, members: [] })
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
                <p className="text-sm text-neutral-500 mt-1">Primero necesitas una wallet. Es tu firma criptografica — con ella creas la organizacion y firmas documentos.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tu nombre completo *</label>
                <input className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Ej: Juan Perez" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Clave para tu wallet *</label>
                <input type="password" className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Minimo 4 caracteres" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Confirmar clave *</label>
                <input type="password" className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" value={adminPassConfirm} onChange={(e) => setAdminPassConfirm(e.target.value)} placeholder="Repite la clave" />
              </div>
              <button onClick={createAdminWallet} disabled={loading}
                className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 disabled:bg-neutral-300 transition-colors">
                {loading ? 'Generando wallet Ed25519...' : 'Crear mi wallet'}
              </button>
              <div className="bg-neutral-50 rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-neutral-500 font-medium">Que se crea:</p>
                <p className="text-[10px] text-neutral-400">Par de claves Ed25519 (firma digital)</p>
                <p className="text-[10px] text-neutral-400">Cifrado con Argon2id + AES-256-GCM</p>
                <p className="text-[10px] text-neutral-400">DID unico derivado de tu clave publica</p>
                <p className="text-[10px] text-neutral-400">La clave privada nunca sale de tu dispositivo</p>
              </div>
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
                    <span className="text-xs text-green-700">Firmando como <span className="font-medium">{adminName}</span> — {adminDid.slice(0, 30)}...</span>
                  </div>
                )}
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
                <h2 className="text-xl font-bold text-neutral-900">Registrar participantes</h2>
                <p className="text-sm text-neutral-500 mt-1">Cada persona recibe su propia wallet para firmar votos.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre</label>
                  <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Clave de wallet</label>
                  <input type="password" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={pPass} onChange={(e) => setPPass(e.target.value)} placeholder="Min. 4 caracteres" />
                </div>
              </div>
              <button onClick={addParticipant} disabled={loading}
                className="w-full bg-neutral-800 text-white py-2 rounded-lg text-sm font-semibold hover:bg-neutral-900 disabled:bg-neutral-300 transition-colors">
                {loading ? 'Generando wallet...' : 'Registrar participante'}
              </button>
              {pMsg && <p className="text-xs text-green-700 bg-green-50 rounded p-2">{pMsg}</p>}

              {participants.length > 0 && (
                <div className="border border-neutral-100 rounded-lg divide-y divide-neutral-100">
                  {participants.map((w) => (
                    <div key={w.walletFile.address} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm font-medium flex-1">{w.name}</span>
                      <span className="text-[10px] font-mono text-neutral-400">{didFromWallet(w.walletFile).slice(0, 25)}...</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Ed25519</span>
                    </div>
                  ))}
                </div>
              )}
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

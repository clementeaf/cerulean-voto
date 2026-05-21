import { useEffect, useState, useCallback } from 'react'
import {
  getProposals,
  submitProposal,
  castVote,
  tallyVotes,
  type Proposal,
  type TallyResult,
} from '../lib/api'
import { pct } from '../lib/format'
import { signVoteWithPrompt, generateVoteNonce } from '../lib/wallet'
import { getAuth } from '../lib/auth'

interface VoteReceipt {
  proposalId: number
  description: string
  option: string
  voterDid: string
  voterAddress: string
  signature: string
  payloadHash: string
  traceId: string
  timestamp: string
}

const STATUS_COLORS: Record<string, string> = {
  Voting: 'bg-blue-100 text-blue-800',
  Passed: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Executed: 'bg-purple-100 text-purple-800',
  Cancelled: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  Voting: 'En votacion',
  Passed: 'Aprobada',
  Rejected: 'Rechazada',
  Executed: 'Ejecutada',
  Cancelled: 'Cancelada',
}

const GUARANTEES = [
  { label: 'Firmado con Ed25519', detail: 'Tu clave privada genero una firma unica e irrepetible' },
  { label: 'Identidad verificada', detail: 'El nodo verifico tu firma contra tu clave publica registrada' },
  { label: 'Voto secreto', detail: 'Tu identidad fue reemplazada por un ID ciego — nadie sabe como votaste' },
  { label: 'Registrado en blockchain', detail: 'Inmutable — nadie puede eliminarlo ni modificarlo' },
  { label: 'Proteccion post-cuantica', detail: 'Compatible con ML-DSA-65 (FIPS 204) para migracion futura' },
]

export default function Elections() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [tallies, setTallies] = useState<Record<number, TallyResult>>({})
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signing, setSigning] = useState(false)
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null)
  const [visibleChecks, setVisibleChecks] = useState(0)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  // Create form
  const [proposerName, setProposerName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const auth = getAuth()
  const optionLabels: Record<string, string> = { Yes: 'A favor', No: 'En contra', Abstain: 'Abstencion' }
  const proposerDid = `did:cerulean:${proposerName.trim().toLowerCase().replace(/\s+/g, '-') || 'anonimo'}`

  const active = proposals.filter((p) => p.status === 'Voting')
  const closed = proposals.filter((p) => p.status !== 'Voting')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const list = await getProposals()
      setProposals(list)
      for (const p of list) {
        try {
          const t = await tallyVotes(p.id)
          setTallies((prev) => ({ ...prev, [p.id]: t }))
        } catch { /* empty */ }
      }
    } catch { /* empty */ }
    setLoading(false)
  }

  async function handleCreate() {
    setMsg(''); setErr('')
    if (!title.trim()) { setErr('El titulo es obligatorio'); return }
    if (!proposerName.trim()) { setErr('El nombre del organizador es obligatorio'); return }
    try {
      await submitProposal({
        proposer: proposerDid,
        description: `${title.trim()}${description.trim() ? ` — ${description.trim()}` : ''}`,
        deposit: 10000,
        action: { type: 'text', title: title.trim(), description: description.trim() },
      })
      setMsg('Eleccion creada')
      setTitle(''); setDescription(''); setProposerName('')
      load()
      setTimeout(() => setDrawerOpen(false), 800)
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al crear eleccion')
    }
  }

  const animateChecks = useCallback(() => {
    setVisibleChecks(0)
    for (let i = 1; i <= GUARANTEES.length; i++) {
      setTimeout(() => setVisibleChecks(i), i * 350)
    }
  }, [])

  async function handleVote(proposalId: number, option: 'Yes' | 'No' | 'Abstain') {
    setErr(''); setReceipt(null)
    if (!auth) { setErr('No autenticado'); return }

    const nonce = generateVoteNonce()
    let signature: string
    let publicKey = auth.publicKey

    if (auth.source === 'extension') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cerulean = (window as any).cerulean
      if (!cerulean?.signVote) { setErr('Extension no disponible para firmar'); return }
      try {
        const result = await cerulean.signVote(proposalId, option)
        signature = result.signature
        publicKey = result.public_key || publicKey
      } catch (e: unknown) {
        setErr((e as Error)?.message || 'Firma cancelada')
        return
      }
    } else {
      const { findWalletByDid } = await import('../lib/wallet')
      const wallet = findWalletByDid(auth.did)
      if (!wallet) { setErr('Wallet no encontrada'); return }
      const sig = await signVoteWithPrompt(wallet.walletFile, { proposal_id: proposalId, option, nonce })
      if (!sig) return
      signature = sig
    }

    setSigning(true)
    try {
      const voterDid = auth.did
      const res = await castVote(proposalId, {
        voter: voterDid, option, power: 1,
        signature, public_key: publicKey, nonce,
      })
      const tally = res?.data
      if (tally) setTallies((prev) => ({ ...prev, [proposalId]: tally }))

      const proposal = proposals.find((p) => p.id === proposalId)
      const payloadMsg = `vote:${proposalId}:${option}:${publicKey}:${nonce}`
      const payloadBytes = new TextEncoder().encode(payloadMsg)
      const hashBuf = await crypto.subtle.digest('SHA-256', payloadBytes)
      const payloadHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      setReceipt({
        proposalId,
        description: proposal?.description || `Eleccion #${proposalId}`,
        option: optionLabels[option],
        voterDid,
        voterAddress: auth.address,
        signature, payloadHash,
        traceId: res?.trace_id ?? '',
        timestamp: res?.timestamp ?? new Date().toISOString(),
      })
      animateChecks()
    } catch (e: unknown) {
      const errMsg = (e as Error)?.message || 'Error al votar'
      if (errMsg.includes('decryption failed')) setErr('Clave incorrecta — no se pudo descifrar la wallet')
      else if (errMsg.includes('already voted')) setErr('Ya votaste en esta eleccion')
      else setErr(errMsg)
    } finally {
      setSigning(false)
    }
  }

  function closeReceipt() { setReceipt(null); setVisibleChecks(0) }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-main-600 font-semibold">{active.length} activa{active.length !== 1 ? 's' : ''}</span>
          <span className="text-neutral-400">{closed.length} cerrada{closed.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-main-600 hover:underline">Actualizar</button>
          <button
            onClick={() => { setDrawerOpen(true); setMsg(''); setErr('') }}
            className="bg-main-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
          >
            + Nueva eleccion
          </button>
        </div>
      </div>

      {err && <p className="text-xs text-red-700 bg-red-50 rounded border border-red-100 p-2 mb-2 shrink-0">{err}</p>}

      {/* Elections list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {loading ? (
          <p className="text-sm text-neutral-400 p-4">Cargando...</p>
        ) : proposals.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-100 p-6 text-center">
            <p className="text-sm text-neutral-400">No hay elecciones. Crea la primera.</p>
          </div>
        ) : (
          proposals.map((p) => {
            const tally = tallies[p.id]
            const isActive = p.status === 'Voting'
            const canVote = isActive && !!auth && !signing
            return (
              <section key={p.id} className="bg-white rounded-lg border border-neutral-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold">#{p.id}</span>
                    <span className="text-sm text-neutral-700 truncate">{p.description || '(sin descripcion)'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[p.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['Yes', 'No', 'Abstain'] as const).map((opt) => {
                        const colors: Record<string, string> = {
                          Yes: 'bg-green-600 hover:bg-green-700 text-white',
                          No: 'bg-red-600 hover:bg-red-700 text-white',
                          Abstain: 'bg-neutral-500 hover:bg-neutral-600 text-white',
                        }
                        return (
                          <button key={opt} disabled={!canVote}
                            onClick={() => handleVote(p.id, opt)}
                            className={`${canVote ? colors[opt] : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'} px-3 py-1 rounded text-xs font-semibold transition-colors`}
                          >
                            {signing ? '...' : optionLabels[opt]}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {/* Tally */}
                {tally && tally.total_voted_power > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-0.5 h-2 rounded overflow-hidden mb-1">
                      {tally.yes_power > 0 && <div className="bg-green-500" style={{ width: pct(tally.yes_power, tally.total_voted_power) }} />}
                      {tally.no_power > 0 && <div className="bg-red-500" style={{ width: pct(tally.no_power, tally.total_voted_power) }} />}
                      {tally.abstain_power > 0 && <div className="bg-neutral-300" style={{ width: pct(tally.abstain_power, tally.total_voted_power) }} />}
                    </div>
                    <div className="flex text-[10px] gap-3 text-neutral-500">
                      <span className="text-green-700">A favor: {tally.yes_power}</span>
                      <span className="text-red-700">En contra: {tally.no_power}</span>
                      <span>Abs: {tally.abstain_power}</span>
                      <span className="ml-auto">
                        {tally.quorum_reached ? 'Quorum alcanzado' : 'Sin quorum'}
                        {!isActive && (tally.passed ? ' — Aprobada' : ' — No aprobada')}
                      </span>
                    </div>
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>

      {/* Create drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-neutral-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-semibold">Nueva Eleccion</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded hover:bg-neutral-100 transition-colors">
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Organizador</label>
                <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={proposerName} onChange={(e) => setProposerName(e.target.value)} placeholder="Ej: Juan Perez" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Titulo</label>
                <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Eleccion de directorio 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" rows={4}
                  value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle, opciones, reglas..." />
              </div>
              {msg && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">{msg}</p>}
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 shrink-0">
              <button onClick={handleCreate}
                className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors">
                Crear Eleccion
              </button>
            </div>
          </div>
        </>
      )}

      {/* Receipt overlay */}
      {receipt && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={closeReceipt} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-neutral-100 shadow-lg w-full max-w-md overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-main-600 uppercase tracking-wide">Comprobante de voto</span>
                  <button onClick={closeReceipt} className="text-neutral-300 hover:text-neutral-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm font-semibold text-neutral-900">{receipt.description}</p>
                <p className="text-xs text-neutral-500 mt-0.5">Votaste: <span className="font-medium text-neutral-700">{receipt.option}</span></p>
              </div>
              <div className="px-5 pb-3 space-y-1.5">
                <div className="bg-neutral-50 rounded-lg p-2.5 space-y-1.5 text-[10px]">
                  <div className="flex justify-between"><span className="text-neutral-400">Votante (DID)</span><span className="font-mono text-neutral-600 select-all">{receipt.voterDid.slice(0, 35)}...</span></div>
                  <div className="flex justify-between"><span className="text-neutral-400">Address</span><span className="font-mono text-neutral-600 select-all">{receipt.voterAddress}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-400">Payload SHA-256</span><span className="font-mono text-neutral-600 select-all">{receipt.payloadHash.slice(0, 24)}...</span></div>
                  <div className="flex justify-between"><span className="text-neutral-400">Firma Ed25519</span><span className="font-mono text-neutral-600 select-all">{receipt.signature.slice(0, 24)}...</span></div>
                  <div className="flex justify-between"><span className="text-neutral-400">Trace ID</span><span className="font-mono text-neutral-600">{receipt.traceId.slice(0, 20)}...</span></div>
                </div>
              </div>
              <div className="px-5 pb-4 space-y-2">
                {GUARANTEES.map((g, i) => (
                  <div key={g.label} className={`flex items-start gap-2.5 transition-all duration-300 ${i < visibleChecks ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-300 ${i < visibleChecks ? 'bg-green-500' : 'bg-neutral-100'}`}>
                      {i < visibleChecks && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-800">{g.label}</p>
                      <p className="text-[10px] text-neutral-400 leading-tight">{g.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-neutral-100 px-5 py-3 bg-neutral-50/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-neutral-400">Comprobante</p>
                  <p className="text-xs font-mono text-neutral-600">cer-{receipt.proposalId}-{receipt.traceId.slice(0, 8)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/api/v1/governance/proposals/${receipt.proposalId}/tally`} target="_blank" rel="noreferrer" className="text-[10px] text-main-600 hover:underline">Verificar tally</a>
                  <a href={`/api/v1/governance/proposals/${receipt.proposalId}/export`} target="_blank" rel="noreferrer" className="text-[10px] text-main-600 hover:underline">JSON-LD</a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import {
  getProposals,
  castVote,
  tallyVotes,
  type Proposal,
  type TallyResult,
} from '../lib/api'
import { pct } from '../lib/format'
import {
  getStoredWallets,
  findWalletByName,
  didFromWallet,
  signVote,
  type StoredWallet,
} from '../lib/wallet'

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

const GUARANTEES = [
  { label: 'Firmado con Ed25519', detail: 'Tu clave privada genero una firma unica e irrepetible' },
  { label: 'Identidad verificada', detail: 'El nodo verifico tu firma contra tu clave publica registrada' },
  { label: 'Voto secreto', detail: 'Tu identidad fue reemplazada por un ID ciego — nadie sabe como votaste' },
  { label: 'Registrado en blockchain', detail: 'Inmutable — nadie puede eliminarlo ni modificarlo' },
  { label: 'Proteccion post-cuantica', detail: 'Compatible con ML-DSA-65 (FIPS 204) para migracion futura' },
]

export default function Vote() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [tallies, setTallies] = useState<Record<number, TallyResult>>({})
  const [voterName, setVoterName] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [err, setErr] = useState('')
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null)
  const [visibleChecks, setVisibleChecks] = useState(0)
  const [signing, setSigning] = useState(false)

  const storedWallets = getStoredWallets()
  const selectedWallet: StoredWallet | undefined = findWalletByName(voterName)
  const hasWallet = !!selectedWallet
  const optionLabels: Record<string, string> = { Yes: 'A favor', No: 'En contra', Abstain: 'Abstencion' }

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const all = await getProposals()
      setProposals(all.filter((p) => p.status === 'Voting'))
      for (const p of all.filter((p) => p.status === 'Voting')) {
        try {
          const t = await tallyVotes(p.id)
          setTallies((prev) => ({ ...prev, [p.id]: t }))
        } catch { /* empty */ }
      }
    } catch { /* empty */ }
  }

  const animateChecks = useCallback(() => {
    setVisibleChecks(0)
    for (let i = 1; i <= GUARANTEES.length; i++) {
      setTimeout(() => setVisibleChecks(i), i * 350)
    }
  }, [])

  async function handleVote(proposalId: number, option: 'Yes' | 'No' | 'Abstain') {
    setErr(''); setReceipt(null)
    if (!selectedWallet) { setErr('Selecciona tu wallet'); return }
    if (!passphrase) { setErr('Ingresa la clave de tu wallet'); return }

    setSigning(true)
    try {
      const signature = await signVote(selectedWallet.walletFile, passphrase, { proposal_id: proposalId, option })
      const voterDid = didFromWallet(selectedWallet.walletFile)

      const res = await castVote(proposalId, {
        voter: voterDid, option, power: 1,
        signature, public_key: selectedWallet.walletFile.public_key,
      })
      const tally = res?.data
      if (tally) setTallies((prev) => ({ ...prev, [proposalId]: tally }))

      const proposal = proposals.find((p) => p.id === proposalId)
      const payloadMsg = `vote:${proposalId}:${option}:${selectedWallet.walletFile.public_key}`
      const payloadBytes = new TextEncoder().encode(payloadMsg)
      const hashBuf = await crypto.subtle.digest('SHA-256', payloadBytes)
      const payloadHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      setReceipt({
        proposalId,
        description: proposal?.description || `Eleccion #${proposalId}`,
        option: optionLabels[option],
        voterDid,
        voterAddress: selectedWallet.walletFile.address,
        signature,
        payloadHash,
        traceId: res?.trace_id ?? '',
        timestamp: res?.timestamp ?? new Date().toISOString(),
      })
      animateChecks()
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Error al votar'
      if (msg.includes('decryption failed')) setErr('Clave incorrecta — no se pudo descifrar la wallet')
      else if (msg.includes('already voted')) setErr('Ya votaste en esta eleccion')
      else setErr(msg)
    } finally {
      setSigning(false)
    }
  }

  function closeReceipt() { setReceipt(null); setVisibleChecks(0) }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Voter bar */}
      <div className="bg-white rounded-lg border border-neutral-100 px-3 py-2 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-400 shrink-0">Votante:</label>
          <select
            className="flex-1 min-w-0 rounded border border-neutral-200 px-2 py-1.5 text-sm"
            value={voterName} onChange={(e) => setVoterName(e.target.value)}
          >
            <option value="">Selecciona tu wallet</option>
            {storedWallets.map((w) => (
              <option key={w.walletFile.address} value={w.name}>{w.name}</option>
            ))}
          </select>
          {hasWallet && (
            <input
              type="password"
              className="w-40 rounded border border-neutral-200 px-2 py-1.5 text-sm"
              value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Clave wallet"
            />
          )}
          {hasWallet && passphrase && (
            <span className="text-[10px] text-green-600 shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Listo para firmar
            </span>
          )}
          {hasWallet && !passphrase && (
            <span className="text-[10px] text-amber-500 shrink-0">Ingresa clave</span>
          )}
          {!voterName && <span className="text-[10px] text-neutral-300 shrink-0">Selecciona tu wallet del padron</span>}
        </div>
        {hasWallet && (
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-400">
            <span>DID: <span className="font-mono">{didFromWallet(selectedWallet!.walletFile).slice(0, 30)}...</span></span>
            <span>Address: <span className="font-mono">{selectedWallet!.walletFile.address.slice(0, 12)}...</span></span>
            <span>Algoritmo: {selectedWallet!.walletFile.algorithm.toUpperCase()}</span>
          </div>
        )}
      </div>

      {err && <p className="text-xs text-red-700 bg-red-50 rounded border border-red-100 p-2 mb-2 shrink-0">{err}</p>}

      {/* Elections */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {proposals.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-100 p-4">
            <p className="text-sm text-neutral-400">No hay elecciones abiertas para votar.</p>
          </div>
        ) : (
          proposals.map((p) => {
            const tally = tallies[p.id]
            const canVote = hasWallet && passphrase.length > 0 && !signing
            return (
              <section key={p.id} className="bg-white rounded-lg border border-neutral-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold min-w-0">#{p.id} — {p.description || '(sin descripcion)'}</h2>
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
                </div>
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
                      <span className="ml-auto">{tally.quorum_reached ? 'Quorum alcanzado' : 'Sin quorum'}</span>
                    </div>
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>

      {/* Receipt overlay */}
      {receipt && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={closeReceipt} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-neutral-100 shadow-lg w-full max-w-md overflow-hidden">
              {/* Header */}
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

              {/* Crypto details */}
              <div className="px-5 pb-3 space-y-1.5">
                <div className="bg-neutral-50 rounded-lg p-2.5 space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Votante (DID)</span>
                    <span className="font-mono text-neutral-600 select-all">{receipt.voterDid.slice(0, 35)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Address</span>
                    <span className="font-mono text-neutral-600 select-all">{receipt.voterAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Payload SHA-256</span>
                    <span className="font-mono text-neutral-600 select-all">{receipt.payloadHash.slice(0, 24)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Firma Ed25519</span>
                    <span className="font-mono text-neutral-600 select-all">{receipt.signature.slice(0, 24)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Trace ID</span>
                    <span className="font-mono text-neutral-600">{receipt.traceId.slice(0, 20)}...</span>
                  </div>
                </div>
              </div>

              {/* Guarantees */}
              <div className="px-5 pb-4 space-y-2">
                {GUARANTEES.map((g, i) => (
                  <div key={g.label}
                    className={`flex items-start gap-2.5 transition-all duration-300 ${i < visibleChecks ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
                  >
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

              {/* Footer */}
              <div className="border-t border-neutral-100 px-5 py-3 bg-neutral-50/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-neutral-400">Comprobante</p>
                  <p className="text-xs font-mono text-neutral-600">cer-{receipt.proposalId}-{receipt.traceId.slice(0, 8)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/api/v1/governance/proposals/${receipt.proposalId}/tally`} target="_blank" rel="noreferrer"
                    className="text-[10px] text-main-600 hover:underline">
                    Verificar tally
                  </a>
                  <a href={`/api/v1/governance/proposals/${receipt.proposalId}/export`} target="_blank" rel="noreferrer"
                    className="text-[10px] text-main-600 hover:underline">
                    JSON-LD
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

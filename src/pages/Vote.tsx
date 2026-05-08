import { useEffect, useState, useCallback } from 'react'
import {
  getProposals,
  castVote,
  tallyVotes,
  type Proposal,
  type TallyResult,
} from '../lib/api'
import { pct } from '../lib/format'

interface VoteReceipt {
  proposalId: number
  description: string
  option: string
  blockHeight: number
  traceId: string
  timestamp: string
}

const GUARANTEES = [
  { label: 'Voto firmado', detail: 'Nadie puede falsificar tu voto' },
  { label: 'Registrado en blockchain', detail: 'Nadie puede eliminarlo ni modificarlo' },
  { label: 'Consenso alcanzado', detail: 'Ningun servidor lo altero' },
  { label: 'Proteccion post-cuantica', detail: 'Valido por decadas' },
]

export default function Vote() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [tallies, setTallies] = useState<Record<number, TallyResult>>({})
  const [voterName, setVoterName] = useState('')
  const [err, setErr] = useState('')
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null)
  const [visibleChecks, setVisibleChecks] = useState(0)

  const voterDid = `did:cerulean:${voterName.trim().toLowerCase().replace(/\s+/g, '-') || 'anonimo'}`
  const optionLabels: Record<string, string> = { Yes: 'A favor', No: 'En contra', Abstain: 'Abstencion' }
  const hasVoter = voterName.trim().length > 0

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const all = await getProposals()
      const active = all.filter((p) => p.status === 'Voting')
      setProposals(active)
      for (const p of active) {
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
      setTimeout(() => setVisibleChecks(i), i * 400)
    }
  }, [])

  async function handleVote(proposalId: number, option: 'Yes' | 'No' | 'Abstain') {
    setErr('')
    setReceipt(null)
    if (!voterName.trim()) { setErr('Ingresa tu nombre'); return }
    try {
      const res = await castVote(proposalId, { voter: voterDid, option, power: 1 })
      const t = await tallyVotes(proposalId)
      setTallies((prev) => ({ ...prev, [proposalId]: t }))

      const proposal = proposals.find((p) => p.id === proposalId)
      setReceipt({
        proposalId,
        description: proposal?.description || `Eleccion #${proposalId}`,
        option: optionLabels[option],
        blockHeight: res?.data?.[0]?.voted_at ?? 0,
        traceId: res?.trace_id ?? '',
        timestamp: res?.timestamp ?? new Date().toISOString(),
      })
      animateChecks()
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al votar')
    }
  }

  function closeReceipt() {
    setReceipt(null)
    setVisibleChecks(0)
  }

  // Short receipt code from trace_id
  const receiptCode = receipt
    ? `cer-${receipt.proposalId}-${receipt.traceId.slice(0, 8)}`
    : ''

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Voter bar */}
      <div className="bg-white rounded-lg border border-neutral-100 px-3 py-2 mb-3 shrink-0 flex items-center gap-2">
        <label className="text-xs text-neutral-400 shrink-0">Votante:</label>
        <input
          className="flex-1 min-w-0 rounded border border-neutral-200 px-2 py-1.5 text-sm"
          value={voterName}
          onChange={(e) => setVoterName(e.target.value)}
          placeholder="Tu nombre"
        />
        {!hasVoter && <span className="text-[10px] text-neutral-300 shrink-0">Ingresa tu nombre para votar</span>}
      </div>

      {err && <p className="text-xs text-red-700 bg-red-50 rounded border border-red-100 p-2 mb-2 shrink-0">{err}</p>}

      {/* Elections list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {proposals.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-100 p-4">
            <p className="text-sm text-neutral-400">No hay elecciones abiertas para votar.</p>
          </div>
        ) : (
          proposals.map((p) => {
            const tally = tallies[p.id]
            return (
              <section key={p.id} className="bg-white rounded-lg border border-neutral-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold min-w-0">#{p.id} — {p.description || '(sin descripcion)'}</h2>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(['Yes', 'No', 'Abstain'] as const).map((opt) => {
                      const active: Record<string, string> = {
                        Yes: 'bg-green-600 hover:bg-green-700 text-white',
                        No: 'bg-red-600 hover:bg-red-700 text-white',
                        Abstain: 'bg-neutral-500 hover:bg-neutral-600 text-white',
                      }
                      return (
                        <button
                          key={opt}
                          disabled={!hasVoter}
                          onClick={() => handleVote(p.id, opt)}
                          className={`${hasVoter ? active[opt] : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'} px-3 py-1 rounded text-xs font-semibold transition-colors`}
                        >
                          {optionLabels[opt]}
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
                      <span className="ml-auto">{tally.quorum_reached ? 'Quorum' : 'Sin quorum'}</span>
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
            <div className="bg-white rounded-xl border border-neutral-100 shadow-lg w-full max-w-sm overflow-hidden">
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

              {/* Guarantees — animated */}
              <div className="px-5 pb-4 space-y-2.5">
                {GUARANTEES.map((g, i) => (
                  <div
                    key={g.label}
                    className={`flex items-start gap-2.5 transition-all duration-300 ${
                      i < visibleChecks ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-300 ${
                      i < visibleChecks ? 'bg-green-500' : 'bg-neutral-100'
                    }`}>
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

              {/* Footer — receipt code */}
              <div className="border-t border-neutral-100 px-5 py-3 bg-neutral-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-neutral-400">Comprobante</p>
                    <p className="text-xs font-mono text-neutral-600">{receiptCode}</p>
                  </div>
                  <a
                    href={`/api/v1/governance/proposals/${receipt.proposalId}/tally`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-main-600 hover:underline flex items-center gap-1"
                  >
                    Verificar independientemente
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
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

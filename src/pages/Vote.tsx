import { useEffect, useState } from 'react'
import PageIntro from '../components/PageIntro'
import {
  getProposals,
  castVote,
  tallyVotes,
  type Proposal,
  type TallyResult,
} from '../lib/api'
import { pct } from '../lib/format'

export default function Vote() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [tallies, setTallies] = useState<Record<number, TallyResult>>({})
  const [voter, setVoter] = useState('did:cerulean:')
  const [power, setPower] = useState('1')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    load()
  }, [])

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

  async function handleVote(proposalId: number, option: 'Yes' | 'No' | 'Abstain') {
    setMsg('')
    setErr('')
    if (!voter || voter === 'did:cerulean:') {
      setErr('Ingresa tu DID de votante')
      return
    }
    try {
      await castVote(proposalId, { voter, option, power: Number(power) })
      setMsg(`Voto registrado correctamente en eleccion #${proposalId}`)
      const t = await tallyVotes(proposalId)
      setTallies((prev) => ({ ...prev, [proposalId]: t }))
    } catch (e: unknown) {
      const error = e as Error
      setErr(error?.message || 'Error al registrar voto')
    }
  }

  const optionLabels: Record<string, string> = { Yes: 'A favor', No: 'En contra', Abstain: 'Abstencion' }

  return (
    <div className="space-y-8">
      <PageIntro title="Emitir Voto">
        Selecciona una eleccion activa y emite tu voto. Cada voto queda registrado de forma
        inmutable en la blockchain con firma criptografica.
      </PageIntro>

      {/* Voter identity */}
      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Tu Identidad</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">DID del votante</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm font-mono"
              value={voter}
              onChange={(e) => setVoter(e.target.value)}
              placeholder="did:cerulean:voter001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Poder de voto (stake)</label>
            <input
              type="number"
              className="w-full rounded border px-3 py-2 text-sm"
              value={power}
              onChange={(e) => setPower(e.target.value)}
              min="1"
            />
          </div>
        </div>
      </section>

      {msg && <p className="text-sm text-green-700 bg-green-50 rounded-lg border border-green-200 p-3">{msg}</p>}
      {err && <p className="text-sm text-red-700 bg-red-50 rounded-lg border border-red-200 p-3">{err}</p>}

      {/* Active elections */}
      {proposals.length === 0 ? (
        <section className="bg-white rounded-lg border shadow-sm p-6">
          <p className="text-sm text-neutral-400">No hay elecciones abiertas para votar en este momento.</p>
        </section>
      ) : (
        proposals.map((p) => {
          const tally = tallies[p.id]
          return (
            <section key={p.id} className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">Eleccion #{p.id}</h2>
                  <p className="text-sm text-neutral-600 mt-1">{p.description || '(sin descripcion)'}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                  En votacion
                </span>
              </div>

              {/* Tally bar */}
              {tally && tally.total_voted_power > 0 && (
                <div className="mb-4">
                  <div className="flex gap-0.5 h-4 rounded overflow-hidden mb-1.5">
                    {tally.yes_power > 0 && (
                      <div className="bg-green-500 rounded-l" style={{ width: pct(tally.yes_power, tally.total_voted_power) }} />
                    )}
                    {tally.no_power > 0 && (
                      <div className="bg-red-500" style={{ width: pct(tally.no_power, tally.total_voted_power) }} />
                    )}
                    {tally.abstain_power > 0 && (
                      <div className="bg-neutral-300 rounded-r" style={{ width: pct(tally.abstain_power, tally.total_voted_power) }} />
                    )}
                  </div>
                  <div className="flex text-xs gap-4 text-neutral-500">
                    <span className="text-green-700">A favor: {tally.yes_power.toLocaleString()}</span>
                    <span className="text-red-700">En contra: {tally.no_power.toLocaleString()}</span>
                    <span>Abstencion: {tally.abstain_power.toLocaleString()}</span>
                    <span className="ml-auto">{tally.quorum_reached ? 'Quorum alcanzado' : 'Sin quorum'}</span>
                  </div>
                </div>
              )}

              {/* Vote buttons */}
              <div className="flex flex-wrap gap-3 mt-4">
                {(['Yes', 'No', 'Abstain'] as const).map((opt) => {
                  const colors: Record<string, string> = {
                    Yes: 'bg-green-600 hover:bg-green-700',
                    No: 'bg-red-600 hover:bg-red-700',
                    Abstain: 'bg-neutral-500 hover:bg-neutral-600',
                  }
                  return (
                    <button
                      key={opt}
                      onClick={() => handleVote(p.id, opt)}
                      className={`${colors[opt]} text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors`}
                    >
                      {optionLabels[opt]}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

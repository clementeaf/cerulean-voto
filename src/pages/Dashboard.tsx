import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProposals, tallyVotes, type Proposal, type TallyResult } from '../lib/api'
import { pct } from '../lib/format'

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

export default function Dashboard() {
  const nav = useNavigate()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [tallies, setTallies] = useState<Record<number, TallyResult>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

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

  const active = proposals.filter((p) => p.status === 'Voting')
  const closed = proposals.filter((p) => p.status !== 'Voting')

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <StatCard label="Activas" value={active.length} color="text-blue-600" />
        <StatCard label="Cerradas" value={closed.length} color="text-neutral-600" />
        <StatCard label="Total" value={proposals.length} color="text-main-600" />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active elections */}
        <section className="bg-white rounded-lg border border-neutral-100 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 shrink-0">
            <h2 className="text-sm font-semibold text-neutral-700">Elecciones Activas</h2>
            <button onClick={() => nav('/elections')} className="text-xs text-main-600 hover:underline">
              Crear nueva
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <p className="text-sm text-neutral-400">Cargando...</p>
            ) : active.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay elecciones activas.</p>
            ) : (
              active.map((p) => {
                const tally = tallies[p.id]
                return (
                  <div
                    key={p.id}
                    className="border border-neutral-100 rounded-lg p-2.5 hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => nav('/vote')}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <span className="font-semibold text-sm">#{p.id} — {p.description || 'Sin titulo'}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100'}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400 shrink-0">Bloque #{p.submitted_at}</span>
                    </div>
                    {tally && tally.total_voted_power > 0 && (
                      <div>
                        <div className="flex gap-0.5 h-2 rounded overflow-hidden mb-1">
                          {tally.yes_power > 0 && <div className="bg-green-500" style={{ width: pct(tally.yes_power, tally.total_voted_power) }} />}
                          {tally.no_power > 0 && <div className="bg-red-500" style={{ width: pct(tally.no_power, tally.total_voted_power) }} />}
                          {tally.abstain_power > 0 && <div className="bg-neutral-300" style={{ width: pct(tally.abstain_power, tally.total_voted_power) }} />}
                        </div>
                        <div className="flex text-xs gap-3 text-neutral-500">
                          <span className="text-green-700">Si: {tally.yes_power.toLocaleString()}</span>
                          <span className="text-red-700">No: {tally.no_power.toLocaleString()}</span>
                          <span>Abs: {tally.abstain_power.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Closed elections */}
        <section className="bg-white rounded-lg border border-neutral-100 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-neutral-100 shrink-0">
            <h2 className="text-sm font-semibold text-neutral-700">Finalizadas</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {closed.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay elecciones finalizadas.</p>
            ) : (
              closed.map((p) => {
                const tally = tallies[p.id]
                return (
                  <div key={p.id} className="flex items-center justify-between border-b last:border-0 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium shrink-0">#{p.id}</span>
                      <span className="text-sm text-neutral-600 truncate">{p.description || 'Sin titulo'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[p.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400 shrink-0 ml-2">
                      {tally ? `${tally.total_voted_power.toLocaleString()} votos` : ''}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-neutral-100 px-3 py-2">
      <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

import { useEffect, useState } from 'react'
import PageIntro from '../components/PageIntro'
import { getProposals, tallyVotes, type Proposal, type TallyResult } from '../lib/api'
import { timeAgo, pct } from '../lib/format'

export default function Results() {
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

  return (
    <div className="space-y-8">
      <PageIntro title="Resultados y Auditoria">
        Escrutinio publico de todas las elecciones. Cualquier persona puede verificar los
        resultados sin acceder a votos individuales.
      </PageIntro>

      <div className="flex justify-end">
        <button onClick={load} className="text-sm text-main-600 hover:underline">Actualizar</button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Cargando resultados...</p>
      ) : proposals.length === 0 ? (
        <section className="bg-white rounded-lg border shadow-sm p-6">
          <p className="text-sm text-neutral-400">No hay elecciones registradas.</p>
        </section>
      ) : (
        proposals.map((p) => {
          const tally = tallies[p.id]
          return (
            <section key={p.id} className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold">Eleccion #{p.id}</h2>
                  <p className="text-sm text-neutral-600 mt-0.5">{p.description || '(sin descripcion)'}</p>
                </div>
                <span className="text-xs text-neutral-400">{timeAgo(p.created_at)}</span>
              </div>

              {tally ? (
                <>
                  {/* Visual bar */}
                  <div className="mt-4 mb-2">
                    <div className="flex gap-0.5 h-6 rounded-lg overflow-hidden">
                      {tally.yes_power > 0 && (
                        <div
                          className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: pct(tally.yes_power, tally.total_voted_power) }}
                        >
                          {tally.total_voted_power > 0 ? pct(tally.yes_power, tally.total_voted_power) : ''}
                        </div>
                      )}
                      {tally.no_power > 0 && (
                        <div
                          className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: pct(tally.no_power, tally.total_voted_power) }}
                        >
                          {tally.total_voted_power > 0 ? pct(tally.no_power, tally.total_voted_power) : ''}
                        </div>
                      )}
                      {tally.abstain_power > 0 && (
                        <div
                          className="bg-neutral-300 flex items-center justify-center text-neutral-600 text-xs font-medium"
                          style={{ width: pct(tally.abstain_power, tally.total_voted_power) }}
                        >
                          {tally.total_voted_power > 0 ? pct(tally.abstain_power, tally.total_voted_power) : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm mt-4">
                    <Stat label="A favor" value={tally.yes_power.toLocaleString()} color="text-green-700" />
                    <Stat label="En contra" value={tally.no_power.toLocaleString()} color="text-red-700" />
                    <Stat label="Abstencion" value={tally.abstain_power.toLocaleString()} color="text-neutral-500" />
                    <Stat
                      label="Quorum"
                      value={tally.quorum_reached ? 'Alcanzado' : 'No alcanzado'}
                      color={tally.quorum_reached ? 'text-green-700' : 'text-amber-600'}
                    />
                    <Stat
                      label="Resultado"
                      value={tally.passed ? 'Aprobada' : 'No aprobada'}
                      color={tally.passed ? 'text-green-700' : 'text-red-600'}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-400 mt-3">Sin votos registrados.</p>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-3">
      <p className="text-xs text-neutral-400 mb-0.5">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
    </div>
  )
}

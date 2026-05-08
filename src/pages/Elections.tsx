import { useEffect, useState } from 'react'
import {
  getProposals,
  submitProposal,
  type Proposal,
} from '../lib/api'

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

export default function Elections() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Form
  const [proposerName, setProposerName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const proposerDid = `did:cerulean:${proposerName.trim().toLowerCase().replace(/\s+/g, '-') || 'anonimo'}`

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setProposals(await getProposals())
    } catch { /* empty */ }
  }

  async function handleCreate() {
    setMsg('')
    setErr('')
    if (!title.trim()) {
      setErr('El titulo es obligatorio')
      return
    }
    if (!proposerName.trim()) {
      setErr('El nombre del organizador es obligatorio')
      return
    }
    try {
      await submitProposal({
        proposer: proposerDid,
        description,
        deposit: 10000,
        action: { type: 'text', title, description },
      })
      setMsg('Eleccion creada correctamente')
      setTitle('')
      setDescription('')
      setProposerName('')
      loadData()
      setTimeout(() => setDrawerOpen(false), 1200)
    } catch (e: unknown) {
      const error = e as Error
      setErr(error?.message || 'Error al crear eleccion')
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-end mb-2 shrink-0">
        <button
          onClick={() => { setDrawerOpen(true); setMsg(''); setErr('') }}
          className="bg-main-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors shrink-0"
        >
          + Nueva eleccion
        </button>
      </div>

      {/* Election list — scrollable */}
      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 shrink-0">
          <h2 className="text-sm font-semibold text-neutral-700">Historial</h2>
          <button onClick={loadData} className="text-xs text-main-600 hover:underline">Actualizar</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {proposals.length === 0 ? (
            <p className="text-sm text-neutral-400 p-5">No hay elecciones registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 px-5 pr-3">#</th>
                  <th className="py-2 pr-3">Descripcion</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Creada</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-neutral-50">
                    <td className="py-2 px-3 pr-3 font-mono">{p.id}</td>
                    <td className="py-2.5 pr-3">{p.description || '(sin descripcion)'}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-400 text-xs">Bloque #{p.submitted_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Drawer — slide-over from right */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-neutral-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-semibold">Crear Nueva Eleccion</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded hover:bg-neutral-100 transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Organizador</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={proposerName}
                  onChange={(e) => setProposerName(e.target.value)}
                  placeholder="Ej: Juan Perez"
                />
                <p className="text-xs text-neutral-400 mt-1">Nombre de quien convoca la eleccion</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Titulo</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Eleccion de directorio 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalle de la eleccion, opciones, reglas..."
                />
              </div>

              {msg && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">{msg}</p>}
              {err && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{err}</p>}
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 shrink-0">
              <button
                onClick={handleCreate}
                className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
              >
                Crear Eleccion
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

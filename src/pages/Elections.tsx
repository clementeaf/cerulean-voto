import { useEffect, useState } from 'react'
import PageIntro from '../components/PageIntro'
import {
  getProposals,
  submitProposal,
  getGovernanceParams,
  type Proposal,
  type ProtocolParam,
} from '../lib/api'
import { timeAgo } from '../lib/format'

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
  const [params, setParams] = useState<ProtocolParam[]>([])

  // Form
  const [proposer, setProposer] = useState('did:cerulean:')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deposit, setDeposit] = useState('10000')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setProposals(await getProposals())
    } catch { /* empty */ }
    try {
      setParams(await getGovernanceParams())
    } catch { /* empty */ }
  }

  async function handleCreate() {
    setMsg('')
    setErr('')
    if (!title.trim()) {
      setErr('El titulo es obligatorio')
      return
    }
    try {
      await submitProposal({
        proposer,
        description,
        deposit: Number(deposit),
        action: { type: 'text', title, description },
      })
      setMsg('Eleccion creada correctamente')
      setTitle('')
      setDescription('')
      loadData()
    } catch (e: unknown) {
      const error = e as Error
      setErr(error?.message || 'Error al crear eleccion')
    }
  }

  return (
    <div className="space-y-8">
      <PageIntro title="Gestionar Elecciones">
        Crea nuevas elecciones y consulta el historial completo. Cada eleccion queda registrada
        de forma inmutable en la cadena.
      </PageIntro>

      {/* Create election */}
      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Crear Nueva Eleccion</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Creador (DID)</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={proposer}
              onChange={(e) => setProposer(e.target.value)}
              placeholder="did:cerulean:admin001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Deposito (NOTA)</label>
            <input
              type="number"
              className="w-full rounded border px-3 py-2 text-sm"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
            {params.length > 0 && (
              <p className="text-xs text-neutral-400 mt-1">
                Minimo: {params.find((p) => p.key === 'proposal_deposit')?.value?.toLocaleString() ?? '10,000'} NOTA
              </p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">Titulo de la eleccion</label>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Eleccion de directorio 2026"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
          <textarea
            className="w-full rounded border px-3 py-2 text-sm"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle de la eleccion, opciones, reglas..."
          />
        </div>

        <button
          onClick={handleCreate}
          className="bg-main-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
        >
          Crear Eleccion
        </button>

        {msg && <p className="mt-3 text-sm text-green-700 bg-green-50 rounded p-2">{msg}</p>}
        {err && <p className="mt-3 text-sm text-red-700 bg-red-50 rounded p-2">{err}</p>}
      </section>

      {/* Election list */}
      <section className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Historial de Elecciones</h2>
          <button onClick={loadData} className="text-sm text-main-600 hover:underline">Actualizar</button>
        </div>

        {proposals.length === 0 ? (
          <p className="text-sm text-neutral-400">No hay elecciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Descripcion</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Deposito</th>
                  <th className="py-2">Creada</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-neutral-50">
                    <td className="py-2 pr-3 font-mono">{p.id}</td>
                    <td className="py-2 pr-3">{p.description || '(sin descripcion)'}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{p.deposit.toLocaleString()}</td>
                    <td className="py-2 text-neutral-400">{timeAgo(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

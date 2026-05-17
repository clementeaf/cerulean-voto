import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchAssemblies,
  saveAssembly,
  deleteAssembly,
  getSessionsByAssembly,
  validateConvocatoria,
  getActiveScope,
  type Assembly,
} from '../lib/store'

const TYPE_LABELS: Record<string, string> = {
  ordinaria: 'Ordinaria',
  extraordinaria: 'Extraordinaria',
}

const TYPE_COLORS: Record<string, string> = {
  ordinaria: 'bg-blue-100 text-blue-800',
  extraordinaria: 'bg-amber-100 text-amber-800',
}

export default function Assemblies() {
  const nav = useNavigate()
  const [assemblies, setAssemblies] = useState<Assembly[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => { fetchAssemblies().then(setAssemblies) }, [])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Form
  const [name, setName] = useState('')
  const [type, setType] = useState<'ordinaria' | 'extraordinaria'>('ordinaria')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [convocatoriaDate, setConvocatoriaDate] = useState('')
  const [convocatoriaMethod, setConvocatoriaMethod] = useState<Assembly['convocatoria_method']>('correo_electronico')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function reload() {
    setAssemblies(await fetchAssemblies())
  }

  async function handleCreate() {
    setMsg('')
    setErr('')
    if (!name.trim()) { setErr('El nombre es obligatorio'); return }
    if (!date) { setErr('La fecha es obligatoria'); return }
    if (!convocatoriaDate) { setErr('La fecha de convocatoria es obligatoria (Ley 19.418 Art. 16)'); return }
    if (!location.trim()) { setErr('El lugar es obligatorio'); return }

    // Validate convocatoria deadline (Ley 19.418 Art. 16)
    const convWarning = validateConvocatoria({ type, date, convocatoria_date: convocatoriaDate })
    if (convWarning) { setErr(convWarning); return }

    await saveAssembly({
      name: name.trim(),
      type,
      date,
      location: location.trim(),
      description: description.trim(),
      convocatoria_date: convocatoriaDate,
      convocatoria_method: convocatoriaMethod,
      scope_id: getActiveScope() || '',
    })
    setMsg('Asamblea creada')
    setName('')
    setDate('')
    setLocation('')
    setDescription('')
    setConvocatoriaDate('')
    await reload()
    setTimeout(() => setDrawerOpen(false), 800)
  }

  async function handleDelete(id: string) {
    try {
      await deleteAssembly(id)
      setConfirmDelete(null)
      await reload()
    } catch (e: unknown) {
      setErr((e as Error).message)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 shrink-0">
        {err && <p className="text-xs text-red-700 bg-red-50 rounded border border-red-100 px-3 py-1.5 mr-3">{err}</p>}
        <div className="flex-1" />
        <button
          onClick={() => { setDrawerOpen(true); setMsg(''); setErr('') }}
          className="bg-main-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
        >
          + Nueva asamblea
        </button>
      </div>

      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 shrink-0">
          <h2 className="text-sm font-semibold text-neutral-700">Asambleas</h2>
          <span className="text-xs text-neutral-400">{assemblies.length} registradas</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {assemblies.length === 0 ? (
            <p className="text-sm text-neutral-400 p-5">No hay asambleas registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 px-3">Folio</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Convocatoria</th>
                  <th className="py-2 pr-3">Lugar</th>
                  <th className="py-2 pr-3">Sesiones</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {assemblies.map((a) => {
                  const sessions = getSessionsByAssembly(a.id)
                  return (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-neutral-50">
                      <td className="py-2.5 px-3 font-mono text-neutral-400">{a.folio}</td>
                      <td className="py-2.5 pr-3 font-medium">
                        <button
                          onClick={() => nav(`/sessions?assembly=${a.id}`)}
                          className="text-main-600 hover:underline text-left"
                        >
                          {a.name}
                        </button>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[a.type]}`}>
                          {TYPE_LABELS[a.type]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-500">{a.date}</td>
                      <td className="py-2.5 pr-3 text-neutral-500 text-xs">{a.convocatoria_date}</td>
                      <td className="py-2.5 pr-3 text-neutral-500">{a.location || '--'}</td>
                      <td className="py-2.5 pr-3 text-neutral-500">{sessions.length}</td>
                      <td className="py-2.5 pr-3">
                        {confirmDelete === a.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 font-semibold">Confirmar</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-neutral-400">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(a.id)} className="text-xs text-neutral-400 hover:text-red-500">
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-neutral-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-semibold">Nueva Asamblea</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded hover:bg-neutral-100 transition-colors">
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Asamblea General Ordinaria 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as 'ordinaria' | 'extraordinaria')}
                >
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                </select>
              </div>

              {/* Convocatoria — Ley 19.418 Art. 16 */}
              <div className="bg-blue-50 rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-800">Convocatoria (Ley 19.418 Art. 16)</p>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha de convocatoria</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    value={convocatoriaDate}
                    onChange={(e) => setConvocatoriaDate(e.target.value)}
                  />
                  <p className="text-[10px] text-blue-600 mt-1">
                    Minimo {type === 'ordinaria' ? '5' : '3'} dias antes de la asamblea
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Medio de convocatoria</label>
                  <select
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    value={convocatoriaMethod}
                    onChange={(e) => setConvocatoriaMethod(e.target.value as Assembly['convocatoria_method'])}
                  >
                    <option value="personal">Notificacion personal</option>
                    <option value="publicacion">Publicacion</option>
                    <option value="correo_electronico">Correo electronico</option>
                    <option value="otro">Otro medio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Fecha de la asamblea</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Lugar</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Sala de sesiones, Edificio Central"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objetivo y contexto de la asamblea..."
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
                Crear Asamblea
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

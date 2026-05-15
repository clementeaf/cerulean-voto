import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  getAssemblies,
  getSessionsByAssembly,
  getOrgSettings,
  saveSession,
  updateSession,
  deleteSession,
  saveActa,
  type Session,
  type AgendaItem,
  type Assembly,
} from '../lib/store'

const STATUS_COLORS: Record<string, string> = {
  planificada: 'bg-neutral-100 text-neutral-600',
  en_curso: 'bg-blue-100 text-blue-800',
  cerrada: 'bg-green-100 text-green-800',
}

const STATUS_LABELS: Record<string, string> = {
  planificada: 'Planificada',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
}

const CITATION_LABELS: Record<string, string> = {
  primera: '1a citacion',
  segunda: '2a citacion',
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export default function Sessions() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const assemblyId = params.get('assembly') || ''
  const assemblies = getAssemblies()
  const assembly: Assembly | undefined = assemblies.find((a) => a.id === assemblyId)
  const orgSettings = getOrgSettings()

  const [sessions, setSessions] = useState<Session[]>(() => getSessionsByAssembly(assemblyId))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<Session | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Form
  const [notes, setNotes] = useState('')
  const [attendeesInput, setAttendeesInput] = useState('')
  const [convocante, setConvocante] = useState(orgSettings.president || '')
  const [citation, setCitation] = useState<'primera' | 'segunda'>('primera')
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [newAgendaTitle, setNewAgendaTitle] = useState('')
  const [newAgendaType, setNewAgendaType] = useState<AgendaItem['type']>('informativo')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const nextNumber = useMemo(() => {
    const nums = sessions.map((s) => s.number)
    return nums.length > 0 ? Math.max(...nums) + 1 : 1
  }, [sessions])

  function reload() {
    setSessions(getSessionsByAssembly(assemblyId))
  }

  function addAgendaItem() {
    if (!newAgendaTitle.trim()) return
    setAgendaItems([...agendaItems, { id: uid(), title: newAgendaTitle.trim(), type: newAgendaType, resolved: false, resolution: '' }])
    setNewAgendaTitle('')
  }

  function removeAgendaItem(id: string) {
    setAgendaItems(agendaItems.filter((i) => i.id !== id))
  }

  function getQuorumRequired(cit: 'primera' | 'segunda'): number {
    return cit === 'primera' ? orgSettings.quorum_min_primera : orgSettings.quorum_min_segunda
  }

  function handleCreate() {
    setMsg('')
    setErr('')
    if (!assemblyId) { setErr('No hay asamblea seleccionada'); return }
    if (!convocante.trim()) { setErr('El convocante es obligatorio'); return }
    const attendees = attendeesInput.split(',').map((n) => n.trim()).filter(Boolean)
    if (attendees.length === 0) { setErr('Ingresa al menos un asistente'); return }
    if (agendaItems.length === 0) { setErr('La tabla debe tener al menos un punto'); return }

    const quorumReq = getQuorumRequired(citation)
    const quorumMet = citation === 'segunda' || attendees.length >= quorumReq

    saveSession({
      assembly_id: assemblyId,
      number: nextNumber,
      citation,
      status: 'planificada',
      started_at: null,
      closed_at: null,
      agenda: agendaItems,
      attendees,
      quorum_required: quorumReq,
      quorum_met: quorumMet,
      notes: notes.trim(),
      convocante: convocante.trim(),
    })
    setMsg('Sesion creada')
    setNotes('')
    setAttendeesInput('')
    setConvocante(orgSettings.president || '')
    setAgendaItems([])
    reload()
    setTimeout(() => setDrawerOpen(false), 800)
  }

  function handleStart(s: Session) {
    // Re-check quorum at start time
    const quorumMet = s.citation === 'segunda' || s.attendees.length >= s.quorum_required
    updateSession(s.id, { status: 'en_curso', started_at: new Date().toISOString(), quorum_met: quorumMet })
    reload()
  }

  async function handleClose(s: Session) {
    const now = new Date().toISOString()
    updateSession(s.id, { status: 'cerrada', closed_at: now })
    // Auto-generate acta with all legally required fields
    if (assembly) {
      try {
        await saveActa({
          session_id: s.id,
          assembly_id: assemblyId,
          content: {
            org_name: orgSettings.org_name,
            org_rut: orgSettings.rut,
            assembly_name: assembly.name,
            assembly_type: assembly.type,
            assembly_folio: assembly.folio,
            convocatoria_date: assembly.convocatoria_date,
            convocatoria_method: assembly.convocatoria_method,
            session_number: s.number,
            citation: s.citation,
            date: assembly.date,
            location: assembly.location,
            quorum_required: s.quorum_required,
            attendees_count: s.attendees.length,
            quorum_met: s.quorum_met,
            attendees: s.attendees,
            agenda: s.agenda,
            notes: s.notes,
            started_at: s.started_at,
            closed_at: now,
            president: orgSettings.president,
            secretary: orgSettings.secretary,
          },
        })
      } catch (e: unknown) {
          setErr(`Acta no generada: ${(e as Error).message || 'error desconocido'}`)
        }
    }
    reload()
  }

  function handleDelete(id: string) {
    try {
      deleteSession(id)
      setConfirmDelete(null)
      setSelected(null)
      reload()
    } catch (e: unknown) {
      setErr((e as Error).message)
      setConfirmDelete(null)
    }
  }

  if (!assembly) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-sm text-neutral-400 mb-3">Selecciona una asamblea para ver sus sesiones.</p>
        <button onClick={() => nav('/assemblies')} className="text-sm text-main-600 hover:underline">
          Ir a Asambleas
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/assemblies')} className="text-xs text-main-600 hover:underline">Asambleas</button>
          <span className="text-xs text-neutral-300">/</span>
          <span className="text-sm font-semibold text-neutral-700">#{assembly.folio} {assembly.name}</span>
        </div>
        <button
          onClick={() => { setDrawerOpen(true); setMsg(''); setErr('') }}
          className="bg-main-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
        >
          + Nueva sesion
        </button>
      </div>

      {err && <p className="text-xs text-red-700 bg-red-50 rounded border border-red-100 px-3 py-1.5 mb-2 shrink-0">{err}</p>}

      {/* Session list */}
      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 shrink-0">
          <h2 className="text-sm font-semibold text-neutral-700">Sesiones</h2>
          <span className="text-xs text-neutral-400">{sessions.length} registradas</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-sm text-neutral-400 p-5">No hay sesiones registradas para esta asamblea.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 pr-3">Citacion</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Quorum</th>
                  <th className="py-2 pr-3">Asistentes</th>
                  <th className="py-2 pr-3">Tabla</th>
                  <th className="py-2 pr-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-neutral-50">
                    <td className="py-2.5 px-3 font-mono font-medium">
                      <button onClick={() => setSelected(s)} className="text-main-600 hover:underline">
                        Sesion {s.number}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="text-xs text-neutral-500">{CITATION_LABELS[s.citation]}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium ${s.quorum_met ? 'text-green-600' : 'text-red-500'}`}>
                        {s.quorum_met ? 'Cumple' : 'No cumple'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-500">{s.attendees.length}</td>
                    <td className="py-2.5 pr-3 text-neutral-500">{s.agenda.length} puntos</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        {s.status === 'planificada' && (
                          <button onClick={() => handleStart(s)} className="text-xs text-blue-600 font-semibold hover:underline">
                            Iniciar
                          </button>
                        )}
                        {s.status === 'en_curso' && (
                          <button onClick={() => handleClose(s)} className="text-xs text-green-600 font-semibold hover:underline">
                            Cerrar
                          </button>
                        )}
                        {confirmDelete === s.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(s.id)} className="text-xs text-red-600 font-semibold">Si</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-neutral-400">No</button>
                          </div>
                        ) : (
                          s.status !== 'cerrada' && (
                            <button onClick={() => setConfirmDelete(s.id)} className="text-xs text-neutral-400 hover:text-red-500">
                              Eliminar
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-neutral-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-semibold">Sesion {selected.number}</h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-neutral-100 transition-colors">
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Estado</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Citacion</p>
                  <span className="text-sm">{CITATION_LABELS[selected.citation]}</span>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Convocante</p>
                  <span className="text-sm">{selected.convocante}</span>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Quorum</p>
                  <span className={`text-sm font-medium ${selected.quorum_met ? 'text-green-600' : 'text-red-500'}`}>
                    {selected.quorum_met ? 'Alcanzado' : 'No alcanzado'} ({selected.attendees.length}/{selected.quorum_required})
                  </span>
                </div>
              </div>
              {!selected.quorum_met && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
                  <p className="text-xs text-red-700 font-medium">Sesion sin quorum — los acuerdos no tienen validez legal (Ley 19.418 Art. 16)</p>
                </div>
              )}
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Asistentes ({selected.attendees.length})</p>
                <div className="flex flex-wrap gap-1">
                  {selected.attendees.map((n, i) => (
                    <span key={`${i}-${n}`} className="text-xs bg-neutral-100 px-2 py-0.5 rounded">{n}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Tabla ({selected.agenda.length} puntos)</p>
                <div className="space-y-2">
                  {selected.agenda.map((item, i) => (
                    <div key={item.id} className="border border-neutral-100 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-neutral-400">{i + 1}.</span>
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded">{item.type}</span>
                      </div>
                      {item.resolution && (
                        <p className="text-xs text-neutral-500 mt-1 ml-5">{item.resolution}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {selected.notes && (
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Notas</p>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}
              {selected.started_at && (
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Inicio</p>
                  <p className="text-sm text-neutral-600">{new Date(selected.started_at).toLocaleString('es-CL')}</p>
                </div>
              )}
              {selected.closed_at && (
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Cierre</p>
                  <p className="text-sm text-neutral-600">{new Date(selected.closed_at).toLocaleString('es-CL')}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-neutral-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-semibold">Nueva Sesion #{nextNumber}</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded hover:bg-neutral-100 transition-colors">
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Convocante</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={convocante}
                  onChange={(e) => setConvocante(e.target.value)}
                  placeholder="Nombre de quien convoca"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Citacion</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={citation}
                  onChange={(e) => setCitation(e.target.value as 'primera' | 'segunda')}
                >
                  <option value="primera">Primera citacion (quorum: {orgSettings.quorum_min_primera})</option>
                  <option value="segunda">Segunda citacion (sin minimo)</option>
                </select>
                <p className="text-[10px] text-neutral-400 mt-1">Ley 19.418 Art. 16: segunda citacion se constituye con los que asistan</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Asistentes</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={attendeesInput}
                  onChange={(e) => setAttendeesInput(e.target.value)}
                  placeholder="Nombres separados por coma"
                />
                <p className="text-xs text-neutral-400 mt-1">Ej: Juan Perez, Maria Lopez, Carlos Diaz</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tabla</label>
                <div className="space-y-1.5 mb-2">
                  {agendaItems.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm bg-neutral-50 rounded px-2 py-1">
                      <span className="text-xs font-mono text-neutral-400">{i + 1}.</span>
                      <span className="flex-1">{item.title}</span>
                      <span className="text-[10px] text-neutral-400">{item.type}</span>
                      <button onClick={() => removeAgendaItem(item.id)} className="text-neutral-300 hover:text-red-500">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
                    value={newAgendaTitle}
                    onChange={(e) => setNewAgendaTitle(e.target.value)}
                    placeholder="Punto de tabla"
                    onKeyDown={(e) => e.key === 'Enter' && addAgendaItem()}
                  />
                  <select
                    className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                    value={newAgendaType}
                    onChange={(e) => setNewAgendaType(e.target.value as AgendaItem['type'])}
                  >
                    <option value="informativo">Info</option>
                    <option value="votacion">Votacion</option>
                    <option value="debate">Debate</option>
                  </select>
                  <button onClick={addAgendaItem} className="bg-neutral-100 px-2.5 rounded-lg text-sm hover:bg-neutral-200 transition-colors">
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notas</label>
                <textarea
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones, contexto..."
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
                Crear Sesion
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

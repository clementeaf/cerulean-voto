import { useState } from 'react'
import {
  getActas,
  getAssemblies,
  type Acta,
} from '../lib/store'

const METHOD_LABELS: Record<string, string> = {
  personal: 'Notificacion personal',
  publicacion: 'Publicacion',
  correo_electronico: 'Correo electronico',
  otro: 'Otro medio',
}

export default function Actas() {
  const [actas] = useState<Acta[]>(getActas)
  const assemblies = getAssemblies()
  const [selected, setSelected] = useState<Acta | null>(null)

  function assemblyName(id: string): string {
    return assemblies.find((a) => a.id === id)?.name || '(sin asamblea)'
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 shrink-0">
          <h2 className="text-sm font-semibold text-neutral-700">Libro de Actas</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-neutral-400">ISO 15489 — Registros permanentes</span>
            <span className="text-xs text-neutral-400">{actas.length} actas</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {actas.length === 0 ? (
            <p className="text-sm text-neutral-400 p-5">No hay actas generadas. Las actas se crean automaticamente al cerrar una sesion.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 px-3">Folio</th>
                  <th className="py-2 pr-3">Asamblea</th>
                  <th className="py-2 pr-3">Sesion</th>
                  <th className="py-2 pr-3">Citacion</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Quorum</th>
                  <th className="py-2 pr-3">Asistentes</th>
                  <th className="py-2 pr-3">Hash</th>
                </tr>
              </thead>
              <tbody>
                {actas.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-neutral-50">
                    <td className="py-2.5 px-3 font-mono font-medium">
                      <button onClick={() => setSelected(a)} className="text-main-600 hover:underline">
                        #{a.folio}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3">{assemblyName(a.assembly_id)}</td>
                    <td className="py-2.5 pr-3">Sesion {a.content.session_number}</td>
                    <td className="py-2.5 pr-3 text-xs text-neutral-500">{a.content.citation === 'primera' ? '1a' : '2a'}</td>
                    <td className="py-2.5 pr-3 text-neutral-500">{a.content.date}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium ${a.content.quorum_met ? 'text-green-600' : 'text-red-500'}`}>
                        {a.content.quorum_met ? 'Si' : 'No'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-500">{a.content.attendees_count}</td>
                    <td className="py-2.5 pr-3">
                      <span className="text-[10px] font-mono text-neutral-400" title={a.integrity_hash}>
                        {a.integrity_hash.slice(0, 12)}...
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Detail drawer — legal format, print-friendly */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10 print:hidden" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl border-l border-neutral-100 flex flex-col print:static print:max-w-none print:shadow-none print:border-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0 print:hidden">
              <h2 className="text-lg font-semibold">Acta N {selected.folio}</h2>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="text-xs text-main-600 hover:underline">Imprimir</button>
                <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-neutral-100 transition-colors">
                  <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 print:overflow-visible">
              {/* Header — legal format */}
              <div className="text-center border-b border-neutral-200 pb-4">
                <p className="text-xs text-neutral-400 uppercase tracking-widest">Libro de Actas</p>
                <h3 className="text-base font-bold uppercase mt-1">Acta N {selected.folio}</h3>
                {selected.content.org_name && (
                  <p className="text-sm font-semibold text-neutral-700 mt-1">{selected.content.org_name}</p>
                )}
                {selected.content.org_rut && (
                  <p className="text-xs text-neutral-500">RUT: {selected.content.org_rut}</p>
                )}
              </div>

              {/* Assembly info */}
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Asamblea</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-neutral-400">Nombre</p>
                    <p className="font-medium">{selected.content.assembly_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">Tipo</p>
                    <p className="font-medium">{selected.content.assembly_type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">Folio asamblea</p>
                    <p className="font-medium">#{selected.content.assembly_folio}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400">Sesion</p>
                    <p className="font-medium">N {selected.content.session_number} ({selected.content.citation === 'primera' ? 'Primera' : 'Segunda'} citacion)</p>
                  </div>
                </div>
              </div>

              {/* Convocatoria — Ley 19.418 Art. 16 */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1.5">Convocatoria (Ley 19.418 Art. 16)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-blue-600">Fecha convocatoria</p>
                    <p className="font-medium text-neutral-700">{selected.content.convocatoria_date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-blue-600">Medio</p>
                    <p className="font-medium text-neutral-700">{METHOD_LABELS[selected.content.convocatoria_method] || selected.content.convocatoria_method}</p>
                  </div>
                </div>
              </div>

              {/* Date, location, times */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide">Fecha</p>
                  <p className="font-medium">{selected.content.date}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide">Lugar</p>
                  <p className="font-medium">{selected.content.location || '--'}</p>
                </div>
                {selected.content.started_at && (
                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide">Inicio</p>
                    <p className="font-medium">{new Date(selected.content.started_at).toLocaleString('es-CL')}</p>
                  </div>
                )}
                {selected.content.closed_at && (
                  <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide">Cierre</p>
                    <p className="font-medium">{new Date(selected.content.closed_at).toLocaleString('es-CL')}</p>
                  </div>
                )}
              </div>

              {/* Quorum — Ley 19.418 Art. 16 */}
              <div className={`rounded-lg p-3 ${selected.content.quorum_met ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-xs font-semibold mb-1 ${selected.content.quorum_met ? 'text-green-800' : 'text-red-800'}`}>
                  Quorum (Ley 19.418 Art. 16)
                </p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-neutral-500">Requerido</p>
                    <p className="font-medium">{selected.content.quorum_required}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500">Presentes</p>
                    <p className="font-medium">{selected.content.attendees_count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500">Estado</p>
                    <p className={`font-semibold ${selected.content.quorum_met ? 'text-green-700' : 'text-red-700'}`}>
                      {selected.content.quorum_met ? 'Alcanzado' : 'NO alcanzado'}
                    </p>
                  </div>
                </div>
                {!selected.content.quorum_met && (
                  <p className="text-[10px] text-red-600 mt-1.5">Los acuerdos adoptados sin quorum carecen de validez legal.</p>
                )}
              </div>

              {/* Attendees */}
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Asistentes ({selected.content.attendees_count})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.content.attendees.map((n, i) => (
                    <span key={`${i}-${n}`} className="text-xs bg-neutral-100 px-2 py-0.5 rounded">{n}</span>
                  ))}
                </div>
              </div>

              {/* Agenda */}
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Tabla</p>
                <div className="space-y-2">
                  {selected.content.agenda.map((item, i) => (
                    <div key={item.id} className="border border-neutral-100 rounded-lg p-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-neutral-400 mt-0.5">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.title}</span>
                            <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded">{item.type}</span>
                            {item.resolved && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Resuelto</span>
                            )}
                          </div>
                          {item.resolution && (
                            <p className="text-xs text-neutral-500 mt-1">{item.resolution}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selected.content.notes && (
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Observaciones</p>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap bg-neutral-50 rounded-lg p-3">{selected.content.notes}</p>
                </div>
              )}

              {/* Signatures — Ley 19.418 Art. 17 / Ley 18.046 Art. 72 */}
              <div className="border-t border-neutral-200 pt-4">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">Firmas (Ley 19.418 Art. 17)</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="border-b border-neutral-300 mb-1 h-8" />
                    <p className="text-xs font-medium">{selected.content.president || '(Presidente)'}</p>
                    <p className="text-[10px] text-neutral-400">Presidente</p>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-neutral-300 mb-1 h-8" />
                    <p className="text-xs font-medium">{selected.content.secretary || '(Secretario)'}</p>
                    <p className="text-[10px] text-neutral-400">Secretario</p>
                  </div>
                </div>
              </div>

              {/* Integrity — ISO 15489 */}
              <div className="border-t border-neutral-200 pt-4">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Integridad (ISO 15489)</p>
                <div className="bg-neutral-50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">Hash SHA-256</span>
                    <span className="text-[10px] font-mono text-neutral-600 select-all">{selected.integrity_hash}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">Generada</span>
                    <span className="text-[10px] text-neutral-600">{new Date(selected.generated_at).toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">Blockchain</span>
                    <span className="text-[10px] text-neutral-600">{selected.blockchain_tx || 'Pendiente de anclaje'}</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 pt-1">
                    Registro permanente — no puede ser eliminado ni modificado
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2">
                <p className="text-[10px] text-neutral-300">
                  Cerulean Voto — DLT post-cuantica
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

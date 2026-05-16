import { useState, useEffect } from 'react'
import {
  getOrgSettings,
  saveOrgSettings,
  getAssemblies,
  getSessions,
  getActas,
  type OrgSettings,
} from '../lib/store'
import { getProposals, getHealth, createChannel } from '../lib/api'

export default function Admin() {
  const [settings, setSettings] = useState<OrgSettings>(getOrgSettings)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const [stats, setStats] = useState({ assemblies: 0, sessions: 0, actas: 0, elections: 0, healthy: false })

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const assemblies = getAssemblies().length
    const sessions = getSessions().length
    const actas = getActas().length
    let elections = 0
    let healthy = false
    try {
      const proposals = await getProposals()
      elections = proposals.length
    } catch { /* empty */ }
    try {
      const h = await getHealth()
      healthy = h.status === 'Success' || h.status === 'ok'
    } catch { /* empty */ }
    setStats({ assemblies, sessions, actas, elections, healthy })
  }

  function handleSave() {
    setErr('')
    // Validate required fields
    if (!settings.org_name.trim()) { setErr('El nombre de la organizacion es obligatorio'); return }
    if (!settings.president.trim()) { setErr('El presidente es obligatorio (firma de actas, Ley 19.418 Art. 17)'); return }
    if (!settings.secretary.trim()) { setErr('El secretario es obligatorio (firma de actas, Ley 19.418 Art. 17)'); return }
    if (settings.quorum_min_primera < 1) { setErr('El quorum de primera citacion debe ser al menos 1'); return }
    saveOrgSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function update(field: keyof OrgSettings, value: string | number) {
    setSettings({ ...settings, [field]: value })
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
        <StatCard label="Asambleas" value={stats.assemblies} />
        <StatCard label="Sesiones" value={stats.sessions} />
        <StatCard label="Actas" value={stats.actas} />
        <StatCard label="Elecciones" value={stats.elections} />
        <div className="bg-white rounded-lg border border-neutral-100 px-3 py-2">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Nodo</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${stats.healthy ? 'bg-green-400' : 'bg-red-400'}`} />
            <p className="text-sm font-semibold">{stats.healthy ? 'Conectado' : 'Sin conexion'}</p>
          </div>
        </div>
      </div>

      {/* Org settings */}
      <section className="bg-white rounded-lg border border-neutral-100 shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">Datos de la organizacion</h2>
          {saved && <span className="text-xs text-green-600">Guardado</span>}
        </div>
        <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Nombre de la organizacion *</label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={settings.org_name}
              onChange={(e) => update('org_name', e.target.value)}
              placeholder="Ej: Asociacion Vecinal Norte"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">RUT</label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={settings.rut}
              onChange={(e) => update('rut', e.target.value)}
              placeholder="Ej: 76.000.000-0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Direccion</label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={settings.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Ej: Av. Principal 123, Santiago"
            />
          </div>
          <div className="sm:col-span-2 border-t border-neutral-100 pt-3">
            <p className="text-xs font-semibold text-neutral-600 mb-3">Firmantes de actas (Ley 19.418 Art. 17)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Presidente *</label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={settings.president}
              onChange={(e) => update('president', e.target.value)}
              placeholder="Nombre completo"
            />
            <p className="text-[10px] text-neutral-400 mt-1">Obligatorio para validez de actas</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Secretario(a) *</label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={settings.secretary}
              onChange={(e) => update('secretary', e.target.value)}
              placeholder="Nombre completo"
            />
            <p className="text-[10px] text-neutral-400 mt-1">Obligatorio para validez de actas</p>
          </div>
          <div className="sm:col-span-2 border-t border-neutral-100 pt-3">
            <p className="text-xs font-semibold text-neutral-600 mb-3">Quorum (Ley 19.418 Art. 16)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Quorum primera citacion</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={settings.quorum_min_primera}
              onChange={(e) => update('quorum_min_primera', parseInt(e.target.value) || 1)}
            />
            <p className="text-[10px] text-neutral-400 mt-1">Numero minimo de asistentes (mayoria absoluta de socios)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Quorum segunda citacion</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={settings.quorum_min_segunda}
              onChange={(e) => update('quorum_min_segunda', parseInt(e.target.value) || 0)}
            />
            <p className="text-[10px] text-neutral-400 mt-1">0 = se constituye con los que asistan (Ley 19.418)</p>
          </div>
          <div className="sm:col-span-2 border-t border-neutral-100 pt-3">
            <p className="text-xs font-semibold text-neutral-600 mb-3">Canal DLT (aislamiento por organizacion)</p>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-500 mb-1">Channel ID</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono"
                  value={settings.channel_id}
                  onChange={(e) => update('channel_id', e.target.value)}
                  placeholder="Se genera automaticamente al crear canal"
                  readOnly={!!settings.channel_id}
                />
              </div>
              {!settings.channel_id && (
                <button
                  onClick={async () => {
                    if (!settings.org_name.trim()) { setErr('Configura el nombre de la organizacion primero'); return }
                    try {
                      const slug = settings.org_name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                      const result = await createChannel(slug)
                      update('channel_id', result.channel_id || slug)
                      saveOrgSettings({ ...settings, channel_id: result.channel_id || slug })
                      setSaved(true)
                      setTimeout(() => setSaved(false), 2000)
                    } catch (e: unknown) {
                      setErr((e as Error)?.message || 'Error al crear canal')
                    }
                  }}
                  className="bg-main-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors shrink-0"
                >
                  Crear canal
                </button>
              )}
              {settings.channel_id && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium shrink-0">
                  Activo
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1.5">
              {settings.channel_id
                ? 'Todas las operaciones (identidades, votos, actas, credenciales) estan aisladas en este canal.'
                : 'Sin canal propio. Los datos se almacenan en el canal compartido (default). Crea un canal para aislar los datos de tu organizacion.'}
            </p>
          </div>
        </div>
        {err && <p className="text-xs text-red-700 bg-red-50 px-4 py-2">{err}</p>}
        <div className="px-4 py-3 border-t border-neutral-100">
          <button
            onClick={handleSave}
            className="bg-main-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
          >
            Guardar configuracion
          </button>
        </div>
      </section>

      {/* Normativa reference */}
      <section className="bg-white rounded-lg border border-neutral-100 shrink-0">
        <div className="px-3 py-2 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">Normativa aplicada</h2>
        </div>
        <div className="px-4 py-3 space-y-2">
          {[
            { norm: 'Ley 19.418 Art. 16', desc: 'Convocatoria: plazo minimo, primera/segunda citacion, quorum' },
            { norm: 'Ley 19.418 Art. 17', desc: 'Actas: contenido obligatorio, firma presidente y secretario' },
            { norm: 'Ley 18.046 Art. 72', desc: 'Actas de sociedades: registro formal de acuerdos' },
            { norm: 'ISO 15489', desc: 'Gestion de registros: integridad, permanencia, hash SHA-256' },
            { norm: 'ISO 8601', desc: 'Formato de fechas y marcas de tiempo' },
            { norm: 'ISO 27001', desc: 'Seguridad: respaldo blockchain, trazabilidad' },
          ].map((item) => (
            <div key={item.norm} className="flex items-start gap-2">
              <span className="text-[10px] font-mono bg-neutral-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{item.norm}</span>
              <span className="text-xs text-neutral-600">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Interoperability */}
      <section className="bg-white rounded-lg border border-neutral-100 shrink-0">
        <div className="px-3 py-2 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">Interoperabilidad (W3C)</h2>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-neutral-500 mb-3">
            Endpoints estandar para integracion con sistemas externos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: 'DID Resolution', path: '/api/v1/did/{did}', desc: 'W3C DID Document (did-core)', type: 'application/did+ld+json' },
              { label: 'Verifiable Credential', path: '/api/v1/credentials/{id}/vc', desc: 'W3C VC Data Model 2.0', type: 'application/vc+ld+json' },
              { label: 'JSON-LD Export', path: '/api/v1/governance/proposals/{id}/export', desc: 'schema.org VoteAction', type: 'application/ld+json' },
              { label: 'OpenAPI Spec', path: '/api/v1/openapi.json', desc: 'OpenAPI 3.0.3 (66 endpoints)', type: 'application/json' },
            ].map((ep) => (
              <a key={ep.label} href={ep.path.replace('{did}', 'example').replace('{id}', '1')}
                target="_blank" rel="noreferrer"
                className="border border-neutral-100 rounded-lg p-2.5 hover:bg-neutral-50 transition-colors block"
              >
                <p className="text-xs font-semibold text-neutral-800">{ep.label}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">{ep.desc}</p>
                <p className="text-[10px] font-mono text-main-600 mt-1">{ep.type}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Data management */}
      <section className="bg-white rounded-lg border border-neutral-100 shrink-0">
        <div className="px-3 py-2 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">Almacenamiento local</h2>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-neutral-500 mb-3">
            Los datos de asambleas, sesiones y actas se almacenan en el navegador (localStorage).
            Las elecciones y votos se almacenan en la blockchain. Las actas son registros permanentes (ISO 15489).
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const data = {
                  assemblies: localStorage.getItem('cv_assemblies'),
                  sessions: localStorage.getItem('cv_sessions'),
                  actas: localStorage.getItem('cv_actas'),
                  org_settings: localStorage.getItem('cv_org_settings'),
                  counter_assembly: localStorage.getItem('cv_counter_assembly'),
                  counter_acta: localStorage.getItem('cv_counter_acta'),
                }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `cerulean-voto-backup-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="text-xs text-main-600 border border-main-200 px-3 py-1.5 rounded-lg hover:bg-main-50 transition-colors"
            >
              Exportar datos
            </button>
            <label className="text-xs text-main-600 border border-main-200 px-3 py-1.5 rounded-lg hover:bg-main-50 transition-colors cursor-pointer">
              Importar datos
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    try {
                      const data = JSON.parse(reader.result as string) as Record<string, string | null>
                      for (const [key, value] of Object.entries(data)) {
                        if (value != null) localStorage.setItem(`cv_${key}`, value)
                      }
                      loadStats()
                      setSaved(true)
                      setTimeout(() => setSaved(false), 2000)
                    } catch { /* empty */ }
                  }
                  reader.readAsText(file)
                }}
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-neutral-100 px-3 py-2">
      <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-neutral-800">{value}</p>
    </div>
  )
}

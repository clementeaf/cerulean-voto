import { useState, useEffect } from 'react'
import {
  fetchScopes,
  getScopes,
  getScopeChildren,
  getOrgSettings,
  saveScope,
  deleteScope,
  addScopeMember,
  removeScopeMember,
  buildChannelId,
  getActiveScope,
  setActiveScope,
  hasPermission,
  isFounder,
  getRoleInScope,
  type Scope,
  type ScopeMember,
} from '../lib/store'
import { getAuth } from '../lib/auth'
import { createChannel } from '../lib/api'
import { resolveAlias, validateAlias, getCachedAlias } from '../lib/alias'

export default function Scopes() {
  const [scopes, setScopes] = useState<Scope[]>([])
  const orgSettings = getOrgSettings()

  useEffect(() => { fetchScopes().then(setScopes) }, [])
  const [activeId, setActiveId] = useState<string | null>(getActiveScope)
  const [selected, setSelected] = useState<Scope | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Current user from auth (verified wallet)
  const auth = getAuth()
  const currentDid = auth?.did || ''
  const userIsFounder = isFounder(currentDid)

  // Permission check for selected scope
  const canManageSelected = selected ? hasPermission(currentDid, selected.id, 'manage') : false
  const selectedRole = selected ? getRoleInScope(currentDid, selected.id) : null

  // Create form
  const [newName, setNewName] = useState('')
  const [newLabel, setNewLabel] = useState('Departamento')
  const [newParent, setNewParent] = useState<string>('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  // Member form (alias-based)
  const [aliasInput, setAliasInput] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<ScopeMember['role']>('voter')
  const [memberLoading, setMemberLoading] = useState(false)

  async function reload() {
    const fresh = await fetchScopes()
    setScopes(fresh)
    if (selected) setSelected(fresh.find((s) => s.id === selected.id) || null)
  }

  async function handleCreate() {
    setMsg(''); setErr('')
    if (!newName.trim()) { setErr('El nombre es obligatorio'); return }
    if (!orgSettings.channel_id) { setErr('Configura el canal de la organizacion primero en Administracion'); return }

    const parentScope = newParent ? getScopes().find((s) => s.id === newParent) : null
    const channelId = buildChannelId(orgSettings.channel_id, parentScope?.channel_id || null, newName)

    try {
      await createChannel(channelId)
    } catch { /* channel may already exist */ }

    await saveScope({
      name: newName.trim(),
      label: newLabel.trim() || 'Unidad',
      parent_id: newParent || null,
      channel_id: channelId,
      members: [],
    })
    setMsg(`${newLabel} "${newName.trim()}" creado`)
    setNewName('')
    await reload()
    setTimeout(() => setDrawerOpen(false), 800)
  }

  async function handleDelete(id: string) {
    try {
      await deleteScope(id)
      setConfirmDelete(null)
      if (activeId === id) { setActiveScope(null); setActiveId(null) }
      await reload()
    } catch (e: unknown) {
      setErr((e as Error).message)
      setConfirmDelete(null)
    }
  }

  function handleActivate(scopeId: string) {
    const next = activeId === scopeId ? null : scopeId
    setActiveScope(next)
    setActiveId(next)
  }

  async function handleAddMember() {
    if (!selected) return
    setMsg(''); setErr('')
    const raw = aliasInput.trim()
    const validationErr = validateAlias(raw)
    if (validationErr) { setErr(validationErr); return }
    setMemberLoading(true)
    try {
      const result = await resolveAlias(raw)
      if (!result) { setErr(`Alias "${raw}" no encontrado en la red`); return }
      await addScopeMember(selected.id, {
        did: result.did,
        name: raw,
        role: addMemberRole,
        status: 'pending',
        added_at: Date.now(),
      })
      setMsg(`Solicitud enviada a @${raw} como ${ROLE_LABELS[addMemberRole]}`)
      setAliasInput('')
      await reload()
    } catch (e: unknown) {
      setErr((e as Error).message)
    } finally {
      setMemberLoading(false)
    }
  }

  async function handleRemoveMember(did: string) {
    if (!selected) return
    await removeScopeMember(selected.id, did)
    await reload()
  }

  function renderTree(parentId: string | null, depth: number): React.JSX.Element[] {
    return getScopeChildren(parentId).map((scope) => {
      const canManage = hasPermission(currentDid, scope.id, 'manage')
      const myRole = getRoleInScope(currentDid, scope.id)
      return (
        <div key={scope.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${activeId === scope.id ? 'bg-main-50' : ''}`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            {depth > 0 && <span className="text-neutral-300 text-xs">└</span>}
            <button onClick={() => setSelected(scope)} className="flex-1 text-left min-w-0">
              <span className="text-sm font-medium text-neutral-800">{scope.name}</span>
              <span className="text-[10px] text-neutral-400 ml-1.5">{scope.label}</span>
            </button>
            {myRole && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_COLORS[myRole]}`}>
                {ROLE_LABELS[myRole]}
              </span>
            )}
            <span className="text-[10px] text-neutral-400 shrink-0">{scope.members.length}</span>
            <button
              onClick={() => handleActivate(scope.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 transition-colors ${
                activeId === scope.id
                  ? 'bg-main-500 text-white'
                  : 'bg-neutral-100 text-neutral-500 hover:bg-main-100 hover:text-main-700'
              }`}
            >
              {activeId === scope.id ? 'Activo' : 'Activar'}
            </button>
            {canManage && (
              confirmDelete === scope.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleDelete(scope.id)} className="text-xs text-red-600 font-semibold">Si</button>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs text-neutral-400">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(scope.id)} className="text-[10px] text-neutral-400 hover:text-red-500 shrink-0">
                  Eliminar
                </button>
              )
            )}
          </div>
          {renderTree(scope.id, depth + 1)}
        </div>
      )
    })
  }

  const ROLE_LABELS: Record<string, string> = { admin: 'Admin', voter: 'Votante', observer: 'Observador' }
  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-50 text-purple-700',
    voter: 'bg-green-50 text-green-700',
    observer: 'bg-neutral-100 text-neutral-500',
  }

  return (
    <div className="h-full flex flex-col min-h-0 gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        {err && <p className="text-xs text-red-700 bg-red-50 rounded border border-red-100 px-3 py-1.5 flex-1">{err}</p>}
        <div className="flex-1" />
        {(userIsFounder || currentDid) && (
          <button
            onClick={() => { setDrawerOpen(true); setMsg(''); setErr('') }}
            className="bg-main-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
          >
            + Nueva unidad
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        {/* Tree */}
        <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-neutral-100 shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">Estructura organizacional</h2>
            <span className="text-xs text-neutral-400">{scopes.length} unidades</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {scopes.length === 0 ? (
              <p className="text-sm text-neutral-400 p-4">Sin unidades. Crea la primera para organizar tu estructura.</p>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </section>

        {/* Detail panel */}
        {selected && (
          <section className="bg-white rounded-lg border border-neutral-100 w-80 shrink-0 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-neutral-100 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700">{selected.name}</h3>
                <p className="text-[10px] text-neutral-400">{selected.label} — {selected.channel_id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Permission banner */}
              {selectedRole && (
                <div className={`rounded-lg p-2 text-[10px] ${selectedRole === 'admin' ? 'bg-purple-50 text-purple-700' : selectedRole === 'voter' ? 'bg-green-50 text-green-700' : 'bg-neutral-50 text-neutral-500'}`}>
                  Tu rol: <span className="font-semibold">{ROLE_LABELS[selectedRole]}</span>
                  {selectedRole === 'admin' && ' — puedes gestionar miembros y sub-unidades'}
                  {selectedRole === 'voter' && ' — puedes votar en elecciones de esta unidad'}
                  {selectedRole === 'observer' && ' — puedes ver resultados (solo lectura)'}
                </div>
              )}
              {!selectedRole && !userIsFounder && (
                <div className="rounded-lg p-2 text-[10px] bg-red-50 text-red-600">
                  No tienes acceso a esta unidad.
                </div>
              )}

              {/* Add member by alias — admin only */}
              {canManageSelected && (
              <div>
                <p className="text-xs font-semibold text-neutral-600 mb-1.5">Agregar miembro por alias</p>
                <div className="flex gap-1.5">
                  <input
                    className="flex-1 rounded border border-neutral-200 px-2 py-1 text-xs"
                    value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
                    placeholder="Alias del participante"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember() }}
                  />
                  <select
                    className="w-24 rounded border border-neutral-200 px-1 py-1 text-xs"
                    value={addMemberRole} onChange={(e) => setAddMemberRole(e.target.value as ScopeMember['role'])}
                  >
                    <option value="voter">Votante</option>
                    <option value="admin">Admin</option>
                    <option value="observer">Observador</option>
                  </select>
                  <button onClick={handleAddMember} disabled={memberLoading}
                    className="bg-main-500 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-main-600 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors">
                    {memberLoading ? '...' : 'Enviar'}
                  </button>
                </div>
                {msg && <p className="text-[10px] text-green-700 mt-1">{msg}</p>}
              </div>
              )}

              {/* Members list */}
              <div>
                <p className="text-xs font-semibold text-neutral-600 mb-1.5">Miembros ({selected.members.length})</p>
                {selected.members.length === 0 ? (
                  <p className="text-[10px] text-neutral-400">Sin miembros asignados.</p>
                ) : (
                  <div className="space-y-1">
                    {selected.members.map((m) => {
                      const alias = getCachedAlias(m.did)
                      const isPending = m.status === 'pending'
                      return (
                        <div key={m.did} className={`flex items-center gap-2 rounded px-2 py-1.5 ${isPending ? 'bg-amber-50' : 'bg-neutral-50'}`}>
                          <span className="text-xs font-medium flex-1 min-w-0 truncate">
                            {alias ? `@${alias}` : m.name}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_COLORS[m.role]}`}>
                            {ROLE_LABELS[m.role]}
                          </span>
                          {isPending && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0">
                              Pendiente
                            </span>
                          )}
                          {canManageSelected && (
                            <button onClick={() => handleRemoveMember(m.did)} className="text-[10px] text-neutral-400 hover:text-red-500 shrink-0">
                              Quitar
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Scope info */}
              <div className="border-t border-neutral-100 pt-2 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-400">Canal DLT</span>
                  <span className="font-mono text-neutral-600">{selected.channel_id}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-400">Creado</span>
                  <span className="text-neutral-600">{new Date(selected.created_at).toLocaleDateString('es-CL')}</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Create drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-neutral-100 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-semibold">Nueva unidad organizacional</h2>
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
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Finanzas, Comite Etica, Sede Norte..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo de unidad</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Ej: Departamento, Comite, Sede, Area, Equipo..."
                />
                <p className="text-[10px] text-neutral-400 mt-1">Tu defines como se llama. No hay estructura impuesta.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Pertenece a</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={newParent} onChange={(e) => setNewParent(e.target.value)}
                >
                  <option value="">Nivel raiz (directamente bajo la organizacion)</option>
                  {scopes.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}: {s.name}</option>
                  ))}
                </select>
              </div>
              {msg && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">{msg}</p>}
              {err && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{err}</p>}
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 shrink-0">
              <button onClick={handleCreate}
                className="w-full bg-main-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors">
                Crear unidad
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

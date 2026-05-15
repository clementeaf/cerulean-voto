// localStorage-backed store for assemblies, sessions, minutes, scopes
// Aligned with: Ley 19.418, Ley 18.046 Art.72, ISO 15489, ISO 8601

export interface Assembly {
  id: string
  folio: number
  name: string
  type: 'ordinaria' | 'extraordinaria'
  date: string
  location: string
  description: string
  convocatoria_date: string
  convocatoria_method: 'personal' | 'publicacion' | 'correo_electronico' | 'otro'
  scope_id: string            // Scope where this assembly belongs
  created_at: number
}

export interface Session {
  id: string
  assembly_id: string
  number: number
  citation: 'primera' | 'segunda'
  status: 'planificada' | 'en_curso' | 'cerrada'
  started_at: string | null
  closed_at: string | null
  agenda: AgendaItem[]
  attendees: string[]
  quorum_required: number
  quorum_met: boolean
  notes: string
  convocante: string
}

export interface AgendaItem {
  id: string
  title: string
  type: 'informativo' | 'votacion' | 'debate'
  proposal_id?: number
  resolved: boolean
  resolution: string
}

export interface Acta {
  id: string
  folio: number
  session_id: string
  assembly_id: string
  generated_at: number
  content: ActaContent
  integrity_hash: string
  blockchain_tx?: string
}

export interface ActaContent {
  org_name: string
  org_rut: string
  assembly_name: string
  assembly_type: string
  assembly_folio: number
  convocatoria_date: string
  convocatoria_method: string
  session_number: number
  citation: string
  date: string
  location: string
  quorum_required: number
  attendees_count: number
  quorum_met: boolean
  attendees: string[]
  agenda: AgendaItem[]
  notes: string
  started_at: string | null
  closed_at: string | null
  president: string
  secretary: string
}

export interface OrgSettings {
  org_name: string
  rut: string
  address: string
  president: string
  secretary: string
  quorum_min_primera: number
  quorum_min_segunda: number
  channel_id: string
  founder_did: string          // DID of the org creator — root admin of everything
}

// ── Scopes (generic organizational units) ────────────────────────────────
// A scope is any organizational unit: department, committee, branch, team, etc.
// Each institution defines its own structure freely — no imposed hierarchy.
// Each scope has its own DLT channel, members, and data isolation.

export interface Scope {
  id: string
  name: string
  label: string              // What the institution calls it: "Departamento", "Comite", "Sede", etc.
  parent_id: string | null   // null = top-level scope
  channel_id: string         // DLT channel (auto-generated: org/scope-slug)
  members: ScopeMember[]     // Who can participate in this scope
  created_at: number
}

export interface ScopeMember {
  did: string                // Wallet DID
  name: string               // Display name
  role: 'admin' | 'voter' | 'observer'  // What they can do in this scope
  added_at: number
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`cv_${key}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed }
    }
    return parsed
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(`cv_${key}`, JSON.stringify(value))
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function nextCounter(key: string): number {
  const current = read<number>(`counter_${key}`, 0)
  const next = current + 1
  write(`counter_${key}`, next)
  return next
}

// ── Scopes ──────────────────────────────────────────────────────────────

export function getScopes(): Scope[] {
  return read<Scope[]>('scopes', [])
}

export function getScope(id: string): Scope | undefined {
  return getScopes().find((s) => s.id === id)
}

export function getScopeChildren(parentId: string | null): Scope[] {
  return getScopes().filter((s) => s.parent_id === parentId)
}

export function getScopesByMember(did: string): Scope[] {
  return getScopes().filter((s) => s.members.some((m) => m.did === did))
}

export function saveScope(s: Omit<Scope, 'id' | 'created_at'>): Scope {
  const list = getScopes()
  const item: Scope = { ...s, id: uid(), created_at: Date.now() }
  write('scopes', [...list, item])
  return item
}

export function updateScope(id: string, patch: Partial<Scope>): void {
  const list = getScopes().map((s) => (s.id === id ? { ...s, ...patch } : s))
  write('scopes', list)
}

export function deleteScope(id: string): void {
  const children = getScopes().filter((s) => s.parent_id === id)
  if (children.length > 0) {
    throw new Error('No se puede eliminar: tiene sub-unidades. Eliminalas primero.')
  }
  write('scopes', getScopes().filter((s) => s.id !== id))
}

export function addScopeMember(scopeId: string, member: ScopeMember): void {
  const scope = getScope(scopeId)
  if (!scope) throw new Error('Scope no encontrado')
  if (scope.members.some((m) => m.did === member.did)) {
    throw new Error('Este miembro ya esta en este scope')
  }
  updateScope(scopeId, { members: [...scope.members, member] })
}

export function removeScopeMember(scopeId: string, did: string): void {
  const scope = getScope(scopeId)
  if (!scope) throw new Error('Scope no encontrado')
  updateScope(scopeId, { members: scope.members.filter((m) => m.did !== did) })
}

export function buildChannelId(orgChannel: string, parentChannelId: string | null, name: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (parentChannelId) return `${parentChannelId}/${slug}`
  if (orgChannel) return `${orgChannel}/${slug}`
  return slug
}

// ── Active scope ────────────────────────────────────────────────────────

export function getActiveScope(): string | null {
  try {
    return localStorage.getItem('cv_active_scope') || null
  } catch {
    return null
  }
}

export function setActiveScope(scopeId: string | null): void {
  if (scopeId) localStorage.setItem('cv_active_scope', scopeId)
  else localStorage.removeItem('cv_active_scope')
}

// ── Assemblies (scoped) ─────────────────────────────────────────────────

export function getAssemblies(scopeId?: string): Assembly[] {
  const all = read<Assembly[]>('assemblies', [])
  return scopeId ? all.filter((a) => a.scope_id === scopeId) : all
}

export function saveAssembly(a: Omit<Assembly, 'id' | 'created_at' | 'folio'>): Assembly {
  const list = read<Assembly[]>('assemblies', [])
  const item: Assembly = { ...a, id: uid(), folio: nextCounter('assembly'), created_at: Date.now() }
  write('assemblies', [item, ...list])
  return item
}

export function deleteAssembly(id: string): void {
  const actas = getActas().filter((a) => a.assembly_id === id)
  if (actas.length > 0) {
    throw new Error('No se puede eliminar una asamblea con actas generadas (ISO 15489)')
  }
  write('assemblies', read<Assembly[]>('assemblies', []).filter((a) => a.id !== id))
  write('sessions', getSessions().filter((s) => s.assembly_id !== id))
}

// ── Convocatoria validation ─────────────────────────────────────────────

export function validateConvocatoria(assembly: Pick<Assembly, 'type' | 'date' | 'convocatoria_date'>): string | null {
  if (!assembly.convocatoria_date || !assembly.date) return null
  const convDate = new Date(assembly.convocatoria_date)
  const asmDate = new Date(assembly.date)
  const diffMs = asmDate.getTime() - convDate.getTime()
  if (diffMs < 0) return 'La fecha de convocatoria debe ser anterior a la fecha de la asamblea'
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const minDays = assembly.type === 'ordinaria' ? 5 : 3
  if (diffDays < minDays) {
    return `Plazo insuficiente: ${diffDays} dias (minimo ${minDays} para asamblea ${assembly.type}, Ley 19.418 Art. 16)`
  }
  return null
}

// ── Sessions ────────────────────────────────────────────────────────────

export function getSessions(): Session[] {
  return read<Session[]>('sessions', [])
}

export function getSessionsByAssembly(assemblyId: string): Session[] {
  return getSessions().filter((s) => s.assembly_id === assemblyId)
}

export function saveSession(s: Omit<Session, 'id'>): Session {
  const list = getSessions()
  const item: Session = { ...s, id: uid() }
  write('sessions', [item, ...list])
  return item
}

export function updateSession(id: string, patch: Partial<Session>): void {
  write('sessions', getSessions().map((s) => (s.id === id ? { ...s, ...patch } : s)))
}

export function deleteSession(id: string): void {
  const actas = getActas().filter((a) => a.session_id === id)
  if (actas.length > 0) throw new Error('No se puede eliminar una sesion con acta generada (ISO 15489)')
  write('sessions', getSessions().filter((s) => s.id !== id))
}

// ── Actas (permanent records) ───────────────────────────────────────────

export function getActas(): Acta[] {
  return read<Acta[]>('actas', [])
}

export async function saveActa(a: Omit<Acta, 'id' | 'generated_at' | 'folio' | 'integrity_hash'>): Promise<Acta> {
  const list = getActas()
  const hash = await sha256(JSON.stringify(a.content))
  const item: Acta = { ...a, id: uid(), folio: nextCounter('acta'), generated_at: Date.now(), integrity_hash: hash }
  write('actas', [item, ...list])
  return item
}

export function updateActaBlockchainTx(actaId: string, txId: string): void {
  write('actas', getActas().map((a) => (a.id === actaId ? { ...a, blockchain_tx: txId } : a)))
}

// ── Org Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: OrgSettings = {
  org_name: '',
  rut: '',
  address: '',
  president: '',
  secretary: '',
  quorum_min_primera: 50,
  quorum_min_segunda: 0,
  channel_id: '',
  founder_did: '',
}

export function getOrgSettings(): OrgSettings {
  return read<OrgSettings>('org_settings', DEFAULT_SETTINGS)
}

export function saveOrgSettings(s: OrgSettings): void {
  write('org_settings', s)
}

// ── Permissions engine ──────────────────────────────────────────────────
// Propagated tree permissions:
//   - Founder is admin of everything (root)
//   - Admin of a scope is admin of all its children (inherited)
//   - Voter/observer roles do NOT propagate downward
//
// Actions:
//   'manage'    — create elections, manage members, create sub-scopes
//   'vote'      — cast votes in elections
//   'view'      — see results, actas, assemblies

export type Permission = 'manage' | 'vote' | 'view'

/** Get the role of a DID in a specific scope, considering inheritance. */
export function getRoleInScope(did: string, scopeId: string): ScopeMember['role'] | null {
  const org = getOrgSettings()

  // Founder is admin everywhere
  if (org.founder_did && org.founder_did === did) return 'admin'

  // Check direct membership
  const scope = getScope(scopeId)
  if (!scope) return null

  const directMember = scope.members.find((m) => m.did === did)
  if (directMember) return directMember.role

  // Check inherited admin from parent chain
  let parentId = scope.parent_id
  while (parentId) {
    const parent = getScope(parentId)
    if (!parent) break
    const parentMember = parent.members.find((m) => m.did === did)
    if (parentMember?.role === 'admin') return 'admin' // admin propagates down
    parentId = parent.parent_id
  }

  return null
}

/** Check if a DID has a specific permission in a scope. */
export function hasPermission(did: string, scopeId: string, permission: Permission): boolean {
  const role = getRoleInScope(did, scopeId)
  if (!role) return false

  switch (permission) {
    case 'manage':
      return role === 'admin'
    case 'vote':
      return role === 'admin' || role === 'voter'
    case 'view':
      return true // all roles can view
  }
}

/** Get all scopes where a DID has at least 'view' permission. */
export function getAccessibleScopes(did: string): Array<{ scope: Scope; role: ScopeMember['role'] }> {
  const org = getOrgSettings()
  const allScopes = getScopes()

  // Founder sees everything
  if (org.founder_did && org.founder_did === did) {
    return allScopes.map((scope) => ({ scope, role: 'admin' as const }))
  }

  const result: Array<{ scope: Scope; role: ScopeMember['role'] }> = []

  for (const scope of allScopes) {
    const role = getRoleInScope(did, scope.id)
    if (role) result.push({ scope, role })
  }

  return result
}

/** Check if a DID is the org founder. */
export function isFounder(did: string): boolean {
  const org = getOrgSettings()
  return !!org.founder_did && org.founder_did === did
}

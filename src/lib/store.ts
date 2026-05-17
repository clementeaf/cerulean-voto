// API-backed store for scopes, assemblies, sessions, actas
// In-memory cache for sync access (permissions engine, interceptor)
// OrgSettings and ActiveScope remain in localStorage (local connection config)
// Aligned with: Ley 19.418, Ley 18.046 Art.72, ISO 15489, ISO 8601

import {
  apiGetScopes, apiCreateScope, apiUpdateScope, apiDeleteScope,
  apiGetAssemblies, apiCreateAssembly, apiDeleteAssembly,
  apiGetSessions, apiCreateSession, apiUpdateSession, apiDeleteSession,
  apiGetActas, apiCreateActa, apiUpdateActa,
} from './api'

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
  scope_id: string
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
  founder_did: string
}

export interface Scope {
  id: string
  name: string
  label: string
  parent_id: string | null
  channel_id: string
  members: ScopeMember[]
  created_at: number
}

export interface ScopeMember {
  did: string
  name: string
  role: 'admin' | 'voter' | 'observer'
  added_at: number
}

// ── localStorage helpers (only for OrgSettings + ActiveScope) ───────────

function readLocal<T>(key: string, fallback: T): T {
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

function writeLocal<T>(key: string, value: T): void {
  localStorage.setItem(`cv_${key}`, JSON.stringify(value))
}

// ── Input validation ────────────────────────────────────────────────────

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Campo obligatorio: ${field}`)
  }
  return value.trim()
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${field} debe ser uno de: ${allowed.join(', ')}`)
  }
  return value as T
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} debe ser un arreglo`)
  }
  return value
}

const SCOPE_ROLES = ['admin', 'voter', 'observer'] as const
const ASSEMBLY_TYPES = ['ordinaria', 'extraordinaria'] as const
const CITATION_TYPES = ['primera', 'segunda'] as const
const SESSION_STATUSES = ['planificada', 'en_curso', 'cerrada'] as const
const CONV_METHODS = ['personal', 'publicacion', 'correo_electronico', 'otro'] as const

// ── In-memory cache ─────────────────────────────────────────────────────
// Populated by fetch* calls, read synchronously by permissions engine

let _scopes: Scope[] = []
let _assemblies: Assembly[] = []
let _sessions: Session[] = []
let _actas: Acta[] = []

// ── Scopes ──────────────────────────────────────────────────────────────

export async function fetchScopes(): Promise<Scope[]> {
  _scopes = await apiGetScopes()
  return _scopes
}

export function getScopes(): Scope[] {
  return _scopes
}

export function getScope(id: string): Scope | undefined {
  return _scopes.find((s) => s.id === id)
}

export function getScopeChildren(parentId: string | null): Scope[] {
  return _scopes.filter((s) => s.parent_id === parentId)
}

export function getScopesByMember(did: string): Scope[] {
  return _scopes.filter((s) => s.members.some((m) => m.did === did))
}

export async function saveScope(s: Omit<Scope, 'id' | 'created_at'>): Promise<Scope> {
  requireString(s.name, 'nombre')
  requireString(s.label, 'tipo de unidad')
  requireString(s.channel_id, 'channel_id')
  requireArray(s.members, 'members')
  const created = await apiCreateScope(s)
  _scopes = [..._scopes, created]
  return created
}

export async function updateScope(id: string, patch: Partial<Scope>): Promise<void> {
  await apiUpdateScope(id, patch)
  _scopes = _scopes.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

export async function deleteScope(id: string): Promise<void> {
  const children = _scopes.filter((s) => s.parent_id === id)
  if (children.length > 0) {
    throw new Error('No se puede eliminar: tiene sub-unidades. Eliminalas primero.')
  }
  await apiDeleteScope(id)
  _scopes = _scopes.filter((s) => s.id !== id)
}

export async function addScopeMember(scopeId: string, member: ScopeMember): Promise<void> {
  requireString(member.did, 'DID del miembro')
  requireString(member.name, 'nombre del miembro')
  requireEnum(member.role, 'rol', SCOPE_ROLES)
  const scope = getScope(scopeId)
  if (!scope) throw new Error('Scope no encontrado')
  if (scope.members.some((m) => m.did === member.did)) {
    throw new Error('Este miembro ya esta en este scope')
  }
  await updateScope(scopeId, { members: [...scope.members, member] })
}

export async function removeScopeMember(scopeId: string, did: string): Promise<void> {
  const scope = getScope(scopeId)
  if (!scope) throw new Error('Scope no encontrado')
  await updateScope(scopeId, { members: scope.members.filter((m) => m.did !== did) })
}

export function buildChannelId(orgChannel: string, parentChannelId: string | null, name: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (parentChannelId) return `${parentChannelId}/${slug}`
  if (orgChannel) return `${orgChannel}/${slug}`
  return slug
}

// ── Active scope (localStorage — local UI preference) ───────────────────

export function getActiveScope(): string | null {
  try {
    return localStorage.getItem('cv_active_scope') || null
  } catch {
    return null
  }
}

export function setActiveScope(scopeId: string | null): void {
  if (scopeId) {
    localStorage.setItem('cv_active_scope', scopeId)
    const scope = getScope(scopeId)
    if (scope?.channel_id) {
      localStorage.setItem('cv_active_scope_channel', scope.channel_id)
    }
  } else {
    localStorage.removeItem('cv_active_scope')
    localStorage.removeItem('cv_active_scope_channel')
  }
}

// ── Assemblies ──────────────────────────────────────────────────────────

export async function fetchAssemblies(scopeId?: string): Promise<Assembly[]> {
  _assemblies = await apiGetAssemblies(scopeId)
  return _assemblies
}

export function getAssemblies(scopeId?: string): Assembly[] {
  return scopeId ? _assemblies.filter((a) => a.scope_id === scopeId) : _assemblies
}

export async function saveAssembly(a: Omit<Assembly, 'id' | 'created_at' | 'folio'>): Promise<Assembly> {
  requireString(a.name, 'nombre de asamblea')
  requireEnum(a.type, 'tipo', ASSEMBLY_TYPES)
  requireString(a.date, 'fecha')
  requireString(a.location, 'lugar')
  requireEnum(a.convocatoria_method, 'metodo de convocatoria', CONV_METHODS)
  const created = await apiCreateAssembly(a)
  _assemblies = [created, ..._assemblies]
  return created
}

export async function deleteAssembly(id: string): Promise<void> {
  const actas = _actas.filter((a) => a.assembly_id === id)
  if (actas.length > 0) {
    throw new Error('No se puede eliminar una asamblea con actas generadas (ISO 15489)')
  }
  await apiDeleteAssembly(id)
  // Cascade delete sessions belonging to this assembly
  const orphanSessions = _sessions.filter((s) => s.assembly_id === id)
  for (const s of orphanSessions) {
    await apiDeleteSession(s.id)
  }
  _assemblies = _assemblies.filter((a) => a.id !== id)
  _sessions = _sessions.filter((s) => s.assembly_id !== id)
}

// ── Convocatoria validation (pure function) ─────────────────────────────

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

export async function fetchSessions(assemblyId?: string): Promise<Session[]> {
  _sessions = await apiGetSessions(assemblyId)
  return _sessions
}

export function getSessions(): Session[] {
  return _sessions
}

export function getSessionsByAssembly(assemblyId: string): Session[] {
  return _sessions.filter((s) => s.assembly_id === assemblyId)
}

export async function saveSession(s: Omit<Session, 'id'>): Promise<Session> {
  requireString(s.assembly_id, 'assembly_id')
  requireEnum(s.citation, 'citacion', CITATION_TYPES)
  requireEnum(s.status, 'estado', SESSION_STATUSES)
  requireArray(s.agenda, 'agenda')
  requireArray(s.attendees, 'asistentes')
  if (typeof s.quorum_required !== 'number' || s.quorum_required < 0) {
    throw new Error('quorum_required debe ser un numero >= 0')
  }
  const created = await apiCreateSession(s)
  _sessions = [created, ..._sessions]
  return created
}

export async function updateSession(id: string, patch: Partial<Session>): Promise<void> {
  await apiUpdateSession(id, patch)
  _sessions = _sessions.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

export async function deleteSession(id: string): Promise<void> {
  const actas = _actas.filter((a) => a.session_id === id)
  if (actas.length > 0) throw new Error('No se puede eliminar una sesion con acta generada (ISO 15489)')
  await apiDeleteSession(id)
  _sessions = _sessions.filter((s) => s.id !== id)
}

// ── Actas (permanent records) ───────────────────────────────────────────

export async function fetchActas(): Promise<Acta[]> {
  _actas = await apiGetActas()
  return _actas
}

export function getActas(): Acta[] {
  return _actas
}

export async function saveActa(a: Omit<Acta, 'id' | 'generated_at' | 'folio' | 'integrity_hash'>): Promise<Acta> {
  requireString(a.session_id, 'session_id')
  requireString(a.assembly_id, 'assembly_id')
  if (!a.content || typeof a.content !== 'object') {
    throw new Error('contenido del acta es obligatorio')
  }
  requireString(a.content.assembly_name, 'nombre de asamblea en acta')
  requireArray(a.content.attendees, 'asistentes en acta')
  requireArray(a.content.agenda, 'agenda en acta')
  const created = await apiCreateActa(a)
  _actas = [created, ..._actas]
  return created
}

export async function updateActaBlockchainTx(actaId: string, txId: string): Promise<void> {
  await apiUpdateActa(actaId, { blockchain_tx: txId })
  _actas = _actas.map((a) => (a.id === actaId ? { ...a, blockchain_tx: txId } : a))
}

// ── Org Settings (localStorage — local connection config) ───────────────

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
  return readLocal<OrgSettings>('org_settings', DEFAULT_SETTINGS)
}

export function saveOrgSettings(s: OrgSettings): void {
  writeLocal('org_settings', s)
}

// ── Permissions engine ──────────────────────────────────────────────────
// Uses in-memory cache (sync) — call fetchScopes() before using permissions
// Propagated tree permissions:
//   - Founder is admin of everything (root)
//   - Admin of a scope is admin of all its children (inherited)
//   - Voter/observer roles do NOT propagate downward

export type Permission = 'manage' | 'vote' | 'view'

export function getRoleInScope(did: string, scopeId: string): ScopeMember['role'] | null {
  const org = getOrgSettings()

  if (org.founder_did && org.founder_did === did) return 'admin'

  const scope = getScope(scopeId)
  if (!scope) return null

  const directMember = scope.members.find((m) => m.did === did)
  if (directMember) return directMember.role

  let parentId = scope.parent_id
  while (parentId) {
    const parent = getScope(parentId)
    if (!parent) break
    const parentMember = parent.members.find((m) => m.did === did)
    if (parentMember?.role === 'admin') return 'admin'
    parentId = parent.parent_id
  }

  return null
}

export function hasPermission(did: string, scopeId: string, permission: Permission): boolean {
  const role = getRoleInScope(did, scopeId)
  if (!role) return false

  switch (permission) {
    case 'manage':
      return role === 'admin'
    case 'vote':
      return role === 'admin' || role === 'voter'
    case 'view':
      return true
  }
}

export function getAccessibleScopes(did: string): Array<{ scope: Scope; role: ScopeMember['role'] }> {
  const org = getOrgSettings()
  const allScopes = getScopes()

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

export function isFounder(did: string): boolean {
  const org = getOrgSettings()
  return !!org.founder_did && org.founder_did === did
}

// ── Cache reset (for testing) ───────────────────────────────────────────

export function _resetCache(): void {
  _scopes = []
  _assemblies = []
  _sessions = []
  _actas = []
}

// localStorage-backed store for assemblies, sessions, and minutes
// Aligned with: Ley 19.418, Ley 18.046 Art.72, ISO 15489, ISO 8601

export interface Assembly {
  id: string
  folio: number                // Correlativo obligatorio (Ley 19.418)
  name: string
  type: 'ordinaria' | 'extraordinaria'
  date: string                 // ISO 8601 date (YYYY-MM-DD)
  location: string
  description: string
  convocatoria_date: string    // Fecha de convocatoria (Ley 19.418 Art.16)
  convocatoria_method: 'personal' | 'publicacion' | 'correo_electronico' | 'otro'
  created_at: number           // unix ms
}

export interface Session {
  id: string
  assembly_id: string
  number: number
  citation: 'primera' | 'segunda' // Primera o segunda citacion (quorum distinto)
  status: 'planificada' | 'en_curso' | 'cerrada'
  started_at: string | null    // ISO 8601 datetime
  closed_at: string | null
  agenda: AgendaItem[]
  attendees: string[]          // names
  quorum_required: number      // Quorum necesario segun citacion
  quorum_met: boolean          // Si se alcanzo quorum
  notes: string
  convocante: string           // Quien convoco la sesion
}

export interface AgendaItem {
  id: string
  title: string
  type: 'informativo' | 'votacion' | 'debate'
  proposal_id?: number         // links to governance proposal
  resolved: boolean
  resolution: string
}

export interface Acta {
  id: string
  folio: number                // Numero correlativo del Libro de Actas (Ley 19.418 Art.17)
  session_id: string
  assembly_id: string
  generated_at: number         // unix ms
  content: ActaContent
  integrity_hash: string       // SHA-256 del contenido (ISO 15489)
  blockchain_tx?: string       // TX ID si fue anclada en blockchain
}

export interface ActaContent {
  // Identificacion de la organizacion (Ley 19.418)
  org_name: string
  org_rut: string
  // Datos de la asamblea
  assembly_name: string
  assembly_type: string
  assembly_folio: number
  // Convocatoria (Ley 19.418 Art.16)
  convocatoria_date: string
  convocatoria_method: string
  // Sesion
  session_number: number
  citation: string
  date: string
  location: string
  // Quorum (Ley 19.418 Art.16)
  quorum_required: number
  attendees_count: number
  quorum_met: boolean
  attendees: string[]
  // Contenido
  agenda: AgendaItem[]
  notes: string
  started_at: string | null
  closed_at: string | null
  // Firmas (Ley 19.418 Art.17 / Ley 18.046 Art.72)
  president: string
  secretary: string
}

export interface OrgSettings {
  org_name: string
  rut: string
  address: string
  president: string
  secretary: string
  quorum_min_primera: number   // Quorum primera citacion (mayoria absoluta)
  quorum_min_segunda: number   // Quorum segunda citacion (los que asistan)
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`cv_${key}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    // Merge with defaults for objects to handle schema migrations
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

// SHA-256 hash for integrity (ISO 15489)
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// -- Counters (correlative numbering) -----------------------------------------

function nextCounter(key: string): number {
  const current = read<number>(`counter_${key}`, 0)
  const next = current + 1
  write(`counter_${key}`, next)
  return next
}

// -- Assemblies ---------------------------------------------------------------

export function getAssemblies(): Assembly[] {
  return read<Assembly[]>('assemblies', [])
}

export function saveAssembly(a: Omit<Assembly, 'id' | 'created_at' | 'folio'>): Assembly {
  const list = getAssemblies()
  const item: Assembly = { ...a, id: uid(), folio: nextCounter('assembly'), created_at: Date.now() }
  write('assemblies', [item, ...list])
  return item
}

export function deleteAssembly(id: string): void {
  // Check if assembly has actas — actas are permanent records (ISO 15489)
  const actas = getActas().filter((a) => a.assembly_id === id)
  if (actas.length > 0) {
    throw new Error('No se puede eliminar una asamblea con actas generadas (ISO 15489 — registros permanentes)')
  }
  write('assemblies', getAssemblies().filter((a) => a.id !== id))
  write('sessions', getSessions().filter((s) => s.assembly_id !== id))
}

// -- Convocatoria validation (Ley 19.418 Art.16) ------------------------------

export function validateConvocatoria(assembly: Pick<Assembly, 'type' | 'date' | 'convocatoria_date'>): string | null {
  if (!assembly.convocatoria_date || !assembly.date) return null
  const convDate = new Date(assembly.convocatoria_date)
  const asmDate = new Date(assembly.date)
  const diffMs = asmDate.getTime() - convDate.getTime()
  if (diffMs < 0) {
    return 'La fecha de convocatoria debe ser anterior a la fecha de la asamblea'
  }
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const minDays = assembly.type === 'ordinaria' ? 5 : 3
  if (diffDays < minDays) {
    return `Plazo insuficiente: ${diffDays} dias (minimo ${minDays} para asamblea ${assembly.type}, Ley 19.418 Art. 16)`
  }
  return null
}

// -- Sessions -----------------------------------------------------------------

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
  const list = getSessions().map((s) => (s.id === id ? { ...s, ...patch } : s))
  write('sessions', list)
}

export function deleteSession(id: string): void {
  // Check if session has actas — actas are permanent records
  const actas = getActas().filter((a) => a.session_id === id)
  if (actas.length > 0) {
    throw new Error('No se puede eliminar una sesion con acta generada (ISO 15489)')
  }
  write('sessions', getSessions().filter((s) => s.id !== id))
}

// -- Actas (permanent records — ISO 15489) ------------------------------------

export function getActas(): Acta[] {
  return read<Acta[]>('actas', [])
}

export async function saveActa(a: Omit<Acta, 'id' | 'generated_at' | 'folio' | 'integrity_hash'>): Promise<Acta> {
  const list = getActas()
  const contentJson = JSON.stringify(a.content)
  const hash = await sha256(contentJson)
  const item: Acta = {
    ...a,
    id: uid(),
    folio: nextCounter('acta'),
    generated_at: Date.now(),
    integrity_hash: hash,
  }
  write('actas', [item, ...list])
  return item
}

export function updateActaBlockchainTx(actaId: string, txId: string): void {
  const list = getActas().map((a) =>
    a.id === actaId ? { ...a, blockchain_tx: txId } : a,
  )
  write('actas', list)
}

// Actas are NEVER deleted (ISO 15489 — permanent records)
// deleteActa intentionally removed

// -- Org Settings -------------------------------------------------------------

const DEFAULT_SETTINGS: OrgSettings = {
  org_name: '',
  rut: '',
  address: '',
  president: '',
  secretary: '',
  quorum_min_primera: 50,  // Mayoria absoluta (% de miembros)
  quorum_min_segunda: 0,   // Los que asistan (sin minimo)
}

export function getOrgSettings(): OrgSettings {
  return read<OrgSettings>('org_settings', DEFAULT_SETTINGS)
}

export function saveOrgSettings(s: OrgSettings): void {
  write('org_settings', s)
}

// Voters moved to wallet.ts — real Ed25519 wallets via WASM

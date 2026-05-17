import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Scope, Assembly, Session, Acta } from './store'

// Mock the API module before importing store
vi.mock('./api', () => ({
  apiGetScopes: vi.fn().mockResolvedValue([]),
  apiCreateScope: vi.fn(),
  apiUpdateScope: vi.fn().mockResolvedValue({}),
  apiDeleteScope: vi.fn().mockResolvedValue(undefined),
  apiGetAssemblies: vi.fn().mockResolvedValue([]),
  apiCreateAssembly: vi.fn(),
  apiUpdateAssembly: vi.fn().mockResolvedValue({}),
  apiDeleteAssembly: vi.fn().mockResolvedValue(undefined),
  apiGetSessions: vi.fn().mockResolvedValue([]),
  apiCreateSession: vi.fn(),
  apiUpdateSession: vi.fn().mockResolvedValue({}),
  apiDeleteSession: vi.fn().mockResolvedValue(undefined),
  apiGetActas: vi.fn().mockResolvedValue([]),
  apiCreateActa: vi.fn(),
  apiUpdateActa: vi.fn().mockResolvedValue({}),
  apiDeleteActa: vi.fn().mockResolvedValue(undefined),
}))

import {
  fetchScopes,
  getScopes,
  getScope,
  getScopeChildren,
  saveScope,
  updateScope,
  deleteScope,
  addScopeMember,
  removeScopeMember,
  buildChannelId,
  getActiveScope,
  setActiveScope,
  getAssemblies,
  saveAssembly,
  deleteAssembly,
  validateConvocatoria,
  getSessions,
  saveSession,
  updateSession,
  deleteSession,
  getActas,
  saveActa,
  updateActaBlockchainTx,
  getOrgSettings,
  saveOrgSettings,
  getRoleInScope,
  hasPermission,
  getAccessibleScopes,
  isFounder,
  _resetCache,
} from './store'
import type { OrgSettings, ScopeMember } from './store'
import {
  apiGetScopes,
  apiCreateScope,
  apiDeleteScope,
  apiCreateAssembly,
  apiCreateSession,
  apiCreateActa,
} from './api'

const mockedApiCreateScope = vi.mocked(apiCreateScope)
const mockedApiDeleteScope = vi.mocked(apiDeleteScope)
const mockedApiGetScopes = vi.mocked(apiGetScopes)
const mockedApiCreateAssembly = vi.mocked(apiCreateAssembly)
const mockedApiCreateSession = vi.mocked(apiCreateSession)
const mockedApiCreateActa = vi.mocked(apiCreateActa)

let idCounter = 0
function fakeId(): string {
  return `fake-${++idCounter}`
}

beforeEach(() => {
  _resetCache()
  localStorage.clear()
  vi.clearAllMocks()
  idCounter = 0

  // Default: apiCreateScope returns input with id + created_at
  mockedApiCreateScope.mockImplementation(async (input) => ({
    ...input,
    id: fakeId(),
    created_at: Date.now(),
  } as Scope))

  mockedApiCreateAssembly.mockImplementation(async (input) => ({
    ...input,
    id: fakeId(),
    folio: idCounter,
    created_at: Date.now(),
  } as Assembly))

  mockedApiCreateSession.mockImplementation(async (input) => ({
    ...input,
    id: fakeId(),
  } as Session))

  mockedApiCreateActa.mockImplementation(async (input) => ({
    ...input,
    id: fakeId(),
    folio: idCounter,
    generated_at: Date.now(),
    integrity_hash: 'a'.repeat(64),
  } as Acta))
})

// ── Scopes ──────────────────────────────────────────────────────────────

describe('Scopes', () => {
  it('starts with empty cache', () => {
    expect(getScopes()).toEqual([])
  })

  it('fetchScopes loads from API into cache', async () => {
    const remote: Scope[] = [
      { id: 's1', name: 'A', label: 'X', parent_id: null, channel_id: 'c', members: [], created_at: 1 },
    ]
    mockedApiGetScopes.mockResolvedValueOnce(remote)
    const result = await fetchScopes()
    expect(result).toEqual(remote)
    expect(getScopes()).toEqual(remote)
  })

  it('saveScope calls API and updates cache', async () => {
    const scope = await saveScope({ name: 'Directiva', label: 'Comite', parent_id: null, channel_id: 'org/directiva', members: [] })
    expect(scope.id).toBeTruthy()
    expect(mockedApiCreateScope).toHaveBeenCalledOnce()
    expect(getScopes()).toHaveLength(1)
    expect(getScope(scope.id)?.name).toBe('Directiva')
  })

  it('getScope finds by id from cache', async () => {
    const s = await saveScope({ name: 'A', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    expect(getScope(s.id)?.name).toBe('A')
    expect(getScope('nonexistent')).toBeUndefined()
  })

  it('getScopeChildren filters by parent', async () => {
    const parent = await saveScope({ name: 'Parent', label: 'Org', parent_id: null, channel_id: 'p', members: [] })
    await saveScope({ name: 'Child1', label: 'Dep', parent_id: parent.id, channel_id: 'p/c1', members: [] })
    await saveScope({ name: 'Child2', label: 'Dep', parent_id: parent.id, channel_id: 'p/c2', members: [] })
    await saveScope({ name: 'Other', label: 'Dep', parent_id: null, channel_id: 'o', members: [] })

    expect(getScopeChildren(parent.id)).toHaveLength(2)
    expect(getScopeChildren(null)).toHaveLength(2)
  })

  it('updateScope merges patch in cache', async () => {
    const s = await saveScope({ name: 'Old', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    await updateScope(s.id, { name: 'New' })
    expect(getScope(s.id)?.name).toBe('New')
    expect(getScope(s.id)?.label).toBe('X')
  })

  it('deleteScope fails if has children', async () => {
    const parent = await saveScope({ name: 'P', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    await saveScope({ name: 'C', label: 'X', parent_id: parent.id, channel_id: 'c/c', members: [] })
    await expect(deleteScope(parent.id)).rejects.toThrow('sub-unidades')
  })

  it('deleteScope calls API and removes from cache', async () => {
    const s = await saveScope({ name: 'Leaf', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    await deleteScope(s.id)
    expect(mockedApiDeleteScope).toHaveBeenCalledWith(s.id)
    expect(getScopes()).toHaveLength(0)
  })
})

// ── Scope Members ───────────────────────────────────────────────────────

describe('Scope Members', () => {
  it('addScopeMember updates cache', async () => {
    const s = await saveScope({ name: 'S', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    const member: ScopeMember = { did: 'did:cerulean:abc', name: 'Alice', role: 'voter', added_at: Date.now() }
    await addScopeMember(s.id, member)
    expect(getScope(s.id)?.members).toHaveLength(1)
  })

  it('addScopeMember rejects duplicate DID', async () => {
    const s = await saveScope({ name: 'S', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    const member: ScopeMember = { did: 'did:cerulean:abc', name: 'Alice', role: 'voter', added_at: Date.now() }
    await addScopeMember(s.id, member)
    await expect(addScopeMember(s.id, member)).rejects.toThrow('ya esta en este scope')
  })

  it('removeScopeMember removes by DID', async () => {
    const s = await saveScope({ name: 'S', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    await addScopeMember(s.id, { did: 'did:cerulean:abc', name: 'Alice', role: 'voter', added_at: Date.now() })
    await addScopeMember(s.id, { did: 'did:cerulean:def', name: 'Bob', role: 'admin', added_at: Date.now() })
    await removeScopeMember(s.id, 'did:cerulean:abc')
    expect(getScope(s.id)?.members).toHaveLength(1)
    expect(getScope(s.id)?.members[0].name).toBe('Bob')
  })
})

// ── buildChannelId (pure function) ──────────────────────────────────────

describe('buildChannelId', () => {
  it('builds from org channel', () => {
    expect(buildChannelId('org-main', null, 'Comite Legal')).toBe('org-main/comite-legal')
  })

  it('builds from parent channel', () => {
    expect(buildChannelId('org', 'org/depto-a', 'Sub Equipo')).toBe('org/depto-a/sub-equipo')
  })

  it('falls back to slug only', () => {
    expect(buildChannelId('', null, 'Root')).toBe('root')
  })

  it('strips non-alphanumeric chars', () => {
    expect(buildChannelId('org', null, 'Año 2024!')).toBe('org/ao-2024')
  })
})

// ── Active Scope ────────────────────────────────────────────────────────

describe('Active Scope', () => {
  it('defaults to null', () => {
    expect(getActiveScope()).toBeNull()
  })

  it('set and get', () => {
    setActiveScope('scope-123')
    expect(getActiveScope()).toBe('scope-123')
  })

  it('set null clears', () => {
    setActiveScope('scope-123')
    setActiveScope(null)
    expect(getActiveScope()).toBeNull()
  })

  it('caches active scope channel_id', async () => {
    const s = await saveScope({ name: 'S', label: 'X', parent_id: null, channel_id: 'org/test', members: [] })
    setActiveScope(s.id)
    expect(localStorage.getItem('cv_active_scope_channel')).toBe('org/test')
  })
})

// ── Assemblies ──────────────────────────────────────────────────────────

describe('Assemblies', () => {
  it('saveAssembly calls API and updates cache', async () => {
    const a = await saveAssembly({
      name: 'Asamblea General', type: 'ordinaria', date: '2024-06-01',
      location: 'Sala 1', description: 'Primera', convocatoria_date: '2024-05-20',
      convocatoria_method: 'personal', scope_id: 'scope-1',
    })
    expect(a.id).toBeTruthy()
    expect(a.folio).toBeGreaterThan(0)
    expect(mockedApiCreateAssembly).toHaveBeenCalledOnce()
    expect(getAssemblies()).toHaveLength(1)
  })

  it('getAssemblies filters by scope from cache', async () => {
    await saveAssembly({ name: 'A', type: 'ordinaria', date: '2024-01-01', location: 'Sala 1', description: '', convocatoria_date: '2023-12-20', convocatoria_method: 'personal', scope_id: 's1' })
    await saveAssembly({ name: 'B', type: 'ordinaria', date: '2024-01-01', location: 'Sala 2', description: '', convocatoria_date: '2023-12-20', convocatoria_method: 'personal', scope_id: 's2' })

    expect(getAssemblies('s1')).toHaveLength(1)
    expect(getAssemblies()).toHaveLength(2)
  })

  it('deleteAssembly removes from cache with sessions', async () => {
    const a = await saveAssembly({ name: 'A', type: 'ordinaria', date: '2024-01-01', location: 'Sala 1', description: '', convocatoria_date: '2023-12-20', convocatoria_method: 'personal', scope_id: 's1' })
    await saveSession({ assembly_id: a.id, number: 1, citation: 'primera', status: 'planificada', started_at: null, closed_at: null, agenda: [], attendees: [], quorum_required: 50, quorum_met: false, notes: '', convocante: '' })

    await deleteAssembly(a.id)
    expect(getAssemblies()).toHaveLength(0)
    expect(getSessions()).toHaveLength(0)
  })
})

// ── Convocatoria Validation ─────────────────────────────────────────────

describe('validateConvocatoria', () => {
  it('returns null for missing dates', () => {
    expect(validateConvocatoria({ type: 'ordinaria', date: '', convocatoria_date: '' })).toBeNull()
  })

  it('rejects convocatoria after assembly date', () => {
    const result = validateConvocatoria({ type: 'ordinaria', date: '2024-06-01', convocatoria_date: '2024-06-05' })
    expect(result).toContain('anterior')
  })

  it('rejects insufficient days for ordinaria (min 5)', () => {
    const result = validateConvocatoria({ type: 'ordinaria', date: '2024-06-05', convocatoria_date: '2024-06-02' })
    expect(result).toContain('insuficiente')
    expect(result).toContain('minimo 5')
  })

  it('rejects insufficient days for extraordinaria (min 3)', () => {
    const result = validateConvocatoria({ type: 'extraordinaria', date: '2024-06-04', convocatoria_date: '2024-06-02' })
    expect(result).toContain('insuficiente')
    expect(result).toContain('minimo 3')
  })

  it('passes with enough days', () => {
    expect(validateConvocatoria({ type: 'ordinaria', date: '2024-06-10', convocatoria_date: '2024-06-01' })).toBeNull()
    expect(validateConvocatoria({ type: 'extraordinaria', date: '2024-06-10', convocatoria_date: '2024-06-01' })).toBeNull()
  })
})

// ── Sessions ────────────────────────────────────────────────────────────

describe('Sessions', () => {
  it('saveSession and updateSession', async () => {
    const s = await saveSession({ assembly_id: 'a1', number: 1, citation: 'primera', status: 'planificada', started_at: null, closed_at: null, agenda: [], attendees: [], quorum_required: 50, quorum_met: false, notes: '', convocante: 'Juan' })
    expect(s.id).toBeTruthy()
    expect(s.convocante).toBe('Juan')

    await updateSession(s.id, { status: 'en_curso', started_at: '2024-06-01T10:00:00' })
    const updated = getSessions().find(x => x.id === s.id)
    expect(updated?.status).toBe('en_curso')
  })

  it('deleteSession fails if acta exists', async () => {
    const s = await saveSession({ assembly_id: 'a1', number: 1, citation: 'primera', status: 'cerrada', started_at: null, closed_at: null, agenda: [], attendees: [], quorum_required: 50, quorum_met: false, notes: '', convocante: '' })
    await saveActa({
      session_id: s.id, assembly_id: 'a1',
      content: { org_name: 'Org', org_rut: '1-1', assembly_name: 'Test', assembly_type: 'ordinaria', assembly_folio: 1, convocatoria_date: '2024-01-01', convocatoria_method: 'personal', session_number: 1, citation: 'primera', date: '2024-06-01', location: 'Sala', quorum_required: 50, attendees_count: 0, quorum_met: false, attendees: ['A'], agenda: [{ id: '1', title: 'P1', type: 'informativo', resolved: false, resolution: '' }], notes: '', started_at: null, closed_at: null, president: 'P', secretary: 'S' },
    })
    await expect(deleteSession(s.id)).rejects.toThrow('ISO 15489')
  })
})

// ── Actas ───────────────────────────────────────────────────────────────

describe('Actas', () => {
  it('saveActa calls API and updates cache', async () => {
    const acta = await saveActa({
      session_id: 's1', assembly_id: 'a1',
      content: { org_name: 'Test Org', org_rut: '12345678-9', assembly_name: 'AG', assembly_type: 'ordinaria', assembly_folio: 1, convocatoria_date: '2024-05-01', convocatoria_method: 'personal', session_number: 1, citation: 'primera', date: '2024-06-01', location: 'Sala', quorum_required: 50, attendees_count: 10, quorum_met: true, attendees: ['Alice'], agenda: [], notes: '', started_at: '2024-06-01T10:00', closed_at: '2024-06-01T11:00', president: 'Pres', secretary: 'Sec' },
    })
    expect(acta.id).toBeTruthy()
    expect(acta.integrity_hash).toBeTruthy()
    expect(mockedApiCreateActa).toHaveBeenCalledOnce()
    expect(getActas()).toHaveLength(1)
  })

  it('updateActaBlockchainTx sets tx in cache', async () => {
    const acta = await saveActa({
      session_id: 's1', assembly_id: 'a1',
      content: { org_name: 'Org', org_rut: '1-1', assembly_name: 'Test', assembly_type: 'ordinaria', assembly_folio: 1, convocatoria_date: '2024-01-01', convocatoria_method: 'personal', session_number: 1, citation: 'primera', date: '2024-06-01', location: 'Sala', quorum_required: 0, attendees_count: 0, quorum_met: false, attendees: ['A'], agenda: [{ id: '1', title: 'P1', type: 'informativo', resolved: false, resolution: '' }], notes: '', started_at: null, closed_at: null, president: 'P', secretary: 'S' },
    })
    await updateActaBlockchainTx(acta.id, 'tx-abc-123')
    const found = getActas().find(a => a.id === acta.id)
    expect(found?.blockchain_tx).toBe('tx-abc-123')
  })
})

// ── Org Settings (localStorage) ─────────────────────────────────────────

describe('OrgSettings', () => {
  it('returns defaults when empty', () => {
    const s = getOrgSettings()
    expect(s.org_name).toBe('')
    expect(s.quorum_min_primera).toBe(50)
  })

  it('save and read', () => {
    const settings: OrgSettings = {
      org_name: 'Junta de Vecinos', rut: '65.432.100-1', address: 'Calle 123',
      president: 'Ana', secretary: 'Luis', quorum_min_primera: 60, quorum_min_segunda: 25,
      channel_id: 'jdv-main', founder_did: 'did:cerulean:founder123',
    }
    saveOrgSettings(settings)
    expect(getOrgSettings()).toEqual(settings)
  })
})

// ── Permissions (sync, uses in-memory cache) ────────────────────────────

describe('Permissions', () => {
  const founderDid = 'did:cerulean:founder'
  const adminDid = 'did:cerulean:admin'
  const voterDid = 'did:cerulean:voter'
  const observerDid = 'did:cerulean:observer'
  const nobodyDid = 'did:cerulean:nobody'

  beforeEach(() => {
    saveOrgSettings({
      org_name: 'Org', rut: '', address: '', president: '', secretary: '',
      quorum_min_primera: 50, quorum_min_segunda: 0,
      channel_id: 'org', founder_did: founderDid,
    })
  })

  async function setupTree() {
    const parent = await saveScope({ name: 'Depto A', label: 'Departamento', parent_id: null, channel_id: 'org/depto-a', members: [] })
    const child = await saveScope({ name: 'Equipo 1', label: 'Equipo', parent_id: parent.id, channel_id: 'org/depto-a/equipo-1', members: [] })
    await addScopeMember(parent.id, { did: adminDid, name: 'Admin', role: 'admin', added_at: Date.now() })
    await addScopeMember(child.id, { did: voterDid, name: 'Voter', role: 'voter', added_at: Date.now() })
    await addScopeMember(child.id, { did: observerDid, name: 'Observer', role: 'observer', added_at: Date.now() })
    return { parent, child }
  }

  it('founder is admin everywhere', async () => {
    const { child } = await setupTree()
    expect(getRoleInScope(founderDid, child.id)).toBe('admin')
    expect(hasPermission(founderDid, child.id, 'manage')).toBe(true)
    expect(hasPermission(founderDid, child.id, 'vote')).toBe(true)
    expect(hasPermission(founderDid, child.id, 'view')).toBe(true)
  })

  it('admin role propagates to children', async () => {
    const { child } = await setupTree()
    expect(getRoleInScope(adminDid, child.id)).toBe('admin')
    expect(hasPermission(adminDid, child.id, 'manage')).toBe(true)
  })

  it('voter role does NOT propagate', async () => {
    const { parent } = await setupTree()
    expect(getRoleInScope(voterDid, parent.id)).toBeNull()
  })

  it('voter can vote but not manage', async () => {
    const { child } = await setupTree()
    expect(hasPermission(voterDid, child.id, 'vote')).toBe(true)
    expect(hasPermission(voterDid, child.id, 'manage')).toBe(false)
    expect(hasPermission(voterDid, child.id, 'view')).toBe(true)
  })

  it('observer can view but not vote or manage', async () => {
    const { child } = await setupTree()
    expect(hasPermission(observerDid, child.id, 'view')).toBe(true)
    expect(hasPermission(observerDid, child.id, 'vote')).toBe(false)
    expect(hasPermission(observerDid, child.id, 'manage')).toBe(false)
  })

  it('unknown DID has no permissions', async () => {
    const { child } = await setupTree()
    expect(hasPermission(nobodyDid, child.id, 'view')).toBe(false)
  })

  it('getAccessibleScopes returns all for founder', async () => {
    await setupTree()
    const accessible = getAccessibleScopes(founderDid)
    expect(accessible).toHaveLength(2)
    expect(accessible.every(a => a.role === 'admin')).toBe(true)
  })

  it('getAccessibleScopes respects membership', async () => {
    await setupTree()
    const accessible = getAccessibleScopes(voterDid)
    expect(accessible).toHaveLength(1)
    expect(accessible[0].role).toBe('voter')
  })

  it('isFounder checks founder_did', () => {
    expect(isFounder(founderDid)).toBe(true)
    expect(isFounder(nobodyDid)).toBe(false)
  })
})

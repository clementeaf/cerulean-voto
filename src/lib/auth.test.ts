import { describe, it, expect, beforeEach } from 'vitest'
import {
  authConnect,
  authDisconnect,
  authRefreshRole,
  getAuth,
  isAuthenticated,
  onAuthChange,
  _resetAuth,
} from './auth'
import { saveOrgSettings, saveScope, addScopeMember, _resetCache } from './store'
import type { OrgSettings } from './store'

// Auth module imports store functions which import api — mock api
import { vi } from 'vitest'
vi.mock('./api', () => ({
  apiGetScopes: vi.fn().mockResolvedValue([]),
  apiCreateScope: vi.fn().mockImplementation(async (input) => ({ ...input, id: 'test-scope', created_at: Date.now() })),
  apiUpdateScope: vi.fn().mockResolvedValue({}),
  apiDeleteScope: vi.fn().mockResolvedValue(undefined),
  apiGetAssemblies: vi.fn().mockResolvedValue([]),
  apiCreateAssembly: vi.fn(),
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

const founderDid = 'did:cerulean:founder'

const orgSettings: OrgSettings = {
  org_name: 'Test', rut: '', address: '', president: '', secretary: '',
  quorum_min_primera: 50, quorum_min_segunda: 0,
  channel_id: 'test-org', founder_did: founderDid,
}

beforeEach(() => {
  _resetAuth()
  _resetCache()
  localStorage.clear()
})

describe('Auth', () => {
  it('starts unauthenticated', () => {
    expect(isAuthenticated()).toBe(false)
    expect(getAuth()).toBeNull()
  })

  it('connect sets auth state', () => {
    saveOrgSettings(orgSettings)
    authConnect(founderDid, 'abc123', 'pubkey-hex')
    expect(isAuthenticated()).toBe(true)
    expect(getAuth()?.did).toBe(founderDid)
    expect(getAuth()?.address).toBe('abc123')
  })

  it('founder gets admin role', () => {
    saveOrgSettings(orgSettings)
    authConnect(founderDid, 'abc123', 'pubkey-hex')
    expect(getAuth()?.role).toBe('admin')
  })

  it('non-founder without scope gets observer role', () => {
    saveOrgSettings(orgSettings)
    authConnect('did:cerulean:nobody', 'def456', 'pubkey2')
    expect(getAuth()?.role).toBe('observer')
  })

  it('voter in active scope gets member role', async () => {
    saveOrgSettings(orgSettings)
    const voterDid = 'did:cerulean:voter'
    const scope = await saveScope({ name: 'S', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    await addScopeMember(scope.id, { did: voterDid, name: 'V', role: 'voter', added_at: Date.now() })
    localStorage.setItem('cv_active_scope', scope.id)

    authConnect(voterDid, 'voter-addr', 'voter-pub')
    expect(getAuth()?.role).toBe('member')
  })

  it('disconnect clears auth', () => {
    saveOrgSettings(orgSettings)
    authConnect(founderDid, 'abc', 'pub')
    authDisconnect()
    expect(isAuthenticated()).toBe(false)
    expect(getAuth()).toBeNull()
  })

  it('refreshRole updates role on scope change', async () => {
    saveOrgSettings(orgSettings)
    const adminDid = 'did:cerulean:admin-user'
    const scope = await saveScope({ name: 'S', label: 'X', parent_id: null, channel_id: 'c', members: [] })
    await addScopeMember(scope.id, { did: adminDid, name: 'A', role: 'admin', added_at: Date.now() })

    // Connect without active scope — gets observer
    authConnect(adminDid, 'admin-addr', 'admin-pub')
    expect(getAuth()?.role).toBe('observer')

    // Set active scope and refresh — gets admin
    localStorage.setItem('cv_active_scope', scope.id)
    authRefreshRole()
    expect(getAuth()?.role).toBe('admin')
  })

  it('notifies listeners on connect/disconnect', () => {
    saveOrgSettings(orgSettings)
    let callCount = 0
    onAuthChange(() => { callCount++ })

    authConnect(founderDid, 'abc', 'pub')
    expect(callCount).toBe(1)

    authDisconnect()
    expect(callCount).toBe(2)
  })
})

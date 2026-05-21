import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock api module
vi.mock('./api', () => ({
  apiCreateInvitation: vi.fn(),
  apiListInvitations: vi.fn(),
  apiRespondInvitation: vi.fn(),
}))

// Mock auth module
vi.mock('./auth', () => ({
  getAuth: vi.fn(),
}))

// Mock alias module — only computeCommitment needed
vi.mock('./alias', () => ({
  computeCommitment: vi.fn((alias: string) => `commitment_for_${alias}`),
}))

import {
  apiCreateInvitation,
  apiListInvitations,
  apiRespondInvitation,
} from './api'
import { getAuth } from './auth'
import {
  createInvitation,
  listMyInvitations,
  respondInvitation,
  _signPayloadForCreate,
  _signPayloadForRespond,
} from './invitations'

const mockCreateInvitation = vi.mocked(apiCreateInvitation)
const mockListInvitations = vi.mocked(apiListInvitations)
const mockRespondInvitation = vi.mocked(apiRespondInvitation)
const mockGetAuth = vi.mocked(getAuth)

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Payload helpers ─────────────────────────────────────────────────────

describe('signPayloadForCreate', () => {
  it('formats commitment:proposalIds', () => {
    expect(_signPayloadForCreate('abc123', [1, 5, 10])).toBe('abc123:1,5,10')
  })

  it('handles single proposal', () => {
    expect(_signPayloadForCreate('abc', [42])).toBe('abc:42')
  })
})

describe('signPayloadForRespond', () => {
  it('formats invitationId:accepted', () => {
    expect(_signPayloadForRespond('inv-1', true)).toBe('inv-1:true')
    expect(_signPayloadForRespond('inv-1', false)).toBe('inv-1:false')
  })
})

// ── createInvitation ────────────────────────────────────────────────────

describe('createInvitation', () => {
  it('throws when not authenticated', async () => {
    mockGetAuth.mockReturnValue(null)
    await expect(createInvitation('pedro', [1])).rejects.toThrow('No autenticado')
  })

  it('does not call API when not authenticated', async () => {
    mockGetAuth.mockReturnValue(null)
    try { await createInvitation('pedro', [1]) } catch { /* expected */ }
    expect(mockCreateInvitation).not.toHaveBeenCalled()
  })
})

// ── listMyInvitations ───────────────────────────────────────────────────

describe('listMyInvitations', () => {
  it('calls API with computed commitment', async () => {
    mockListInvitations.mockResolvedValueOnce([])
    const result = await listMyInvitations('pedro')
    expect(mockListInvitations).toHaveBeenCalledWith('commitment_for_pedro')
    expect(result).toEqual([])
  })

  it('returns invitations from API', async () => {
    const inv = {
      invitation_id: 'inv-1',
      from_did: 'did:cerulean:abc',
      to_commitment: 'commitment_for_pedro',
      proposal_ids: [1, 2],
      signature: 'sig',
      created_at: 1000,
      responded: false,
      accepted: false,
    }
    mockListInvitations.mockResolvedValueOnce([inv])
    const result = await listMyInvitations('pedro')
    expect(result).toHaveLength(1)
    expect(result[0].invitation_id).toBe('inv-1')
  })
})

// ── respondInvitation ───────────────────────────────────────────────────

describe('respondInvitation', () => {
  it('throws when not authenticated', async () => {
    mockGetAuth.mockReturnValue(null)
    await expect(respondInvitation('inv-1', true)).rejects.toThrow('No autenticado')
  })

  it('does not call API when not authenticated', async () => {
    mockGetAuth.mockReturnValue(null)
    try { await respondInvitation('inv-1', true) } catch { /* expected */ }
    expect(mockRespondInvitation).not.toHaveBeenCalled()
  })
})

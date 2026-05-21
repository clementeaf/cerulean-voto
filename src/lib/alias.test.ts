import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock api module before importing alias
vi.mock('./api', () => ({
  apiResolveAlias: vi.fn(),
}))

import {
  validateAlias,
  normalizeAlias,
  computeSalt,
  computeCommitment,
  getCachedAlias,
  cacheAlias,
  resolveAlias,
  _resetAliasCache,
} from './alias'
import { apiResolveAlias } from './api'

const mockResolve = vi.mocked(apiResolveAlias)

beforeEach(() => {
  _resetAliasCache()
  vi.clearAllMocks()
})

// ── Validation ──────────────────────────────────────────────────────────

describe('validateAlias', () => {
  it('rejects empty alias', () => {
    expect(validateAlias('')).toBe('Alias es obligatorio')
  })

  it('rejects alias shorter than 3 chars', () => {
    expect(validateAlias('ab')).toBe('Alias debe tener al menos 3 caracteres')
  })

  it('rejects alias longer than 32 chars', () => {
    expect(validateAlias('a'.repeat(33))).toContain('32 caracteres')
  })

  it('rejects alias with spaces', () => {
    expect(validateAlias('hello world')).not.toBeNull()
  })

  it('rejects alias with special chars', () => {
    expect(validateAlias('pedro<script>')).not.toBeNull()
    expect(validateAlias("pedro's")).not.toBeNull()
  })

  it('accepts valid aliases', () => {
    expect(validateAlias('pedro')).toBeNull()
    expect(validateAlias('juan_perez')).toBeNull()
    expect(validateAlias('maria-gonzalez')).toBeNull()
    expect(validateAlias('abc')).toBeNull()
    expect(validateAlias('a'.repeat(32))).toBeNull()
  })

  it('accepts unicode letters', () => {
    expect(validateAlias('josé')).toBeNull()
    expect(validateAlias('María')).toBeNull()
    expect(validateAlias('niño123')).toBeNull()
  })
})

// ── Normalization ───────────────────────────────────────────────────────

describe('normalizeAlias', () => {
  it('trims whitespace', () => {
    expect(normalizeAlias('  pedro  ')).toBe('pedro')
  })

  it('preserves case (case-sensitive per design)', () => {
    expect(normalizeAlias('Pedro')).toBe('Pedro')
  })

  it('applies NFC normalization', () => {
    // é as e + combining acute vs precomposed é
    const decomposed = 'jose\u0301'
    const composed = 'jos\u00e9'
    expect(normalizeAlias(decomposed)).toBe(composed)
  })
})

// ── Commitment computation ──────────────────────────────────────────────

describe('computeSalt', () => {
  it('returns 32 hex chars (16 bytes)', () => {
    const salt = computeSalt('pedro')
    expect(salt).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is deterministic', () => {
    expect(computeSalt('pedro')).toBe(computeSalt('pedro'))
  })

  it('differs for different aliases', () => {
    expect(computeSalt('pedro')).not.toBe(computeSalt('maria'))
  })
})

describe('computeCommitment', () => {
  it('returns 64 hex chars (SHA3-256)', () => {
    const commitment = computeCommitment('pedro')
    expect(commitment).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', () => {
    expect(computeCommitment('pedro')).toBe(computeCommitment('pedro'))
  })

  it('differs for different aliases', () => {
    expect(computeCommitment('pedro')).not.toBe(computeCommitment('maria'))
  })

  it('case-sensitive: Pedro !== pedro', () => {
    expect(computeCommitment('Pedro')).not.toBe(computeCommitment('pedro'))
  })
})

// ── Cache ───────────────────────────────────────────────────────────────

describe('alias cache', () => {
  it('returns null for uncached DID', () => {
    expect(getCachedAlias('did:cerulean:abc')).toBeNull()
  })

  it('stores and retrieves alias', () => {
    cacheAlias('did:cerulean:abc', 'pedro')
    expect(getCachedAlias('did:cerulean:abc')).toBe('pedro')
  })

  it('clears on reset', () => {
    cacheAlias('did:cerulean:abc', 'pedro')
    _resetAliasCache()
    expect(getCachedAlias('did:cerulean:abc')).toBeNull()
  })
})

// ── resolveAlias (integration with API mock) ────────────────────────────

describe('resolveAlias', () => {
  it('rejects invalid alias', async () => {
    await expect(resolveAlias('ab')).rejects.toThrow('al menos 3')
  })

  it('calls API with computed commitment', async () => {
    mockResolve.mockResolvedValueOnce({ did: 'did:cerulean:abc123', address: 'abc123' })
    const result = await resolveAlias('pedro')
    expect(mockResolve).toHaveBeenCalledWith(computeCommitment('pedro'))
    expect(result).toEqual({ did: 'did:cerulean:abc123', address: 'abc123' })
  })

  it('caches alias on successful resolution', async () => {
    mockResolve.mockResolvedValueOnce({ did: 'did:cerulean:xyz', address: 'xyz' })
    await resolveAlias('maria')
    expect(getCachedAlias('did:cerulean:xyz')).toBe('maria')
  })

  it('returns null when alias not found', async () => {
    mockResolve.mockResolvedValueOnce(null)
    const result = await resolveAlias('noexiste')
    expect(result).toBeNull()
  })

  it('does not cache when alias not found', async () => {
    mockResolve.mockResolvedValueOnce(null)
    await resolveAlias('noexiste')
    expect(getCachedAlias('did:cerulean:any')).toBeNull()
  })
})

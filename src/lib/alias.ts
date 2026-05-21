// Alias resolution module — Phase 3 of ALIAS_DESIGN.md
// Client-side commitment computation + API resolution
// Aliases are zero-knowledge: only commitments stored on-chain

import { sha3_256 } from 'js-sha3'

// ── Validation ──────────────────────────────────────────────────────────

const ALIAS_REGEX = /^[\p{L}\p{N}_-]{3,32}$/u

export function validateAlias(alias: string): string | null {
  if (!alias) return 'Alias es obligatorio'
  if (alias.length < 3) return 'Alias debe tener al menos 3 caracteres'
  if (alias.length > 32) return 'Alias no puede exceder 32 caracteres'
  if (!ALIAS_REGEX.test(alias)) return 'Alias solo puede contener letras, numeros, guiones y guion bajo'
  return null
}

// ── Normalization ───────────────────────────────────────────────────────

export function normalizeAlias(alias: string): string {
  return alias.trim().normalize('NFC')
}

// ── Commitment computation (deterministic salt) ─────────────────────────
// Salt = SHA3-256("cerulean:alias:salt:" || alias)[0..16] (first 16 bytes)
// Commitment = SHA3-256(salt || alias)

export function computeSalt(alias: string): string {
  const normalized = normalizeAlias(alias)
  const fullHash = sha3_256('cerulean:alias:salt:' + normalized)
  return fullHash.slice(0, 32) // 16 bytes = 32 hex chars
}

export function computeCommitment(alias: string): string {
  const normalized = normalizeAlias(alias)
  const salt = computeSalt(normalized)
  return sha3_256(salt + normalized)
}

// ── Local alias cache (in-memory) ───────────────────────────────────────
// Maps DID → alias for display in voter lists
// Populated when aliases are resolved; not persisted

const _aliasCache = new Map<string, string>()

export function getCachedAlias(did: string): string | null {
  return _aliasCache.get(did) ?? null
}

export function cacheAlias(did: string, alias: string): void {
  _aliasCache.set(did, alias)
}

export function clearAliasCache(): void {
  _aliasCache.clear()
}

export function getAllCachedAliases(): ReadonlyMap<string, string> {
  return _aliasCache
}

// ── Resolve alias via API ───────────────────────────────────────────────

import { apiResolveAlias, type AliasResolution } from './api'

export async function resolveAlias(alias: string): Promise<AliasResolution | null> {
  const error = validateAlias(alias)
  if (error) throw new Error(error)

  const normalized = normalizeAlias(alias)
  const commitment = computeCommitment(normalized)
  const result = await apiResolveAlias(commitment)

  if (result) {
    cacheAlias(result.did, normalized)
  }

  return result
}

// ── Reset for testing ───────────────────────────────────────────────────

export function _resetAliasCache(): void {
  _aliasCache.clear()
}

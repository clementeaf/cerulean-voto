// Authentication module — in-memory only, never persisted to localStorage
// Tracks the connected wallet and derived role for API header injection

import { getOrgSettings, getActiveScope, getRoleInScope, type ScopeMember } from './store'

export interface AuthState {
  did: string
  address: string
  publicKey: string
  role: MspRole
}

// Roles the backend understands in strict mode
export type MspRole = 'admin' | 'member' | 'observer'

let _auth: AuthState | null = null
let _activeChannel: string | null = null
let _listeners: Array<() => void> = []

function notify(): void {
  for (const fn of _listeners) fn()
}

/** Map scope role to MSP role for the backend header */
function toMspRole(scopeRole: ScopeMember['role'] | null, isFounder: boolean): MspRole {
  if (isFounder) return 'admin'
  switch (scopeRole) {
    case 'admin': return 'admin'
    case 'voter': return 'member'
    case 'observer': return 'observer'
    default: return 'observer'
  }
}

/** Derive the MSP role for the currently connected DID */
function deriveRole(did: string): MspRole {
  const org = getOrgSettings()
  const isFounder = !!org.founder_did && org.founder_did === did

  if (isFounder) return 'admin'

  const activeScopeId = getActiveScope()
  if (activeScopeId) {
    const scopeRole = getRoleInScope(did, activeScopeId)
    return toMspRole(scopeRole, false)
  }

  return 'observer'
}

/** Connect a verified wallet. Call only after passphrase verification. */
export function authConnect(did: string, address: string, publicKey: string): void {
  _auth = {
    did,
    address,
    publicKey,
    role: deriveRole(did),
  }
  notify()
}

/** Disconnect — clears auth state */
export function authDisconnect(): void {
  _auth = null
  notify()
}

/** Refresh role (call when active scope changes) */
export function authRefreshRole(): void {
  if (_auth) {
    _auth = { ..._auth, role: deriveRole(_auth.did) }
    notify()
  }
}

/** Get current auth state — null if not connected */
export function getAuth(): AuthState | null {
  return _auth
}

/** Set active channel (in-memory — called by store.setActiveScope) */
export function setActiveChannel(channelId: string | null): void {
  _activeChannel = channelId
}

/** Get active channel for API header injection */
export function getActiveChannel(): string | null {
  return _activeChannel
}

/** Check if authenticated */
export function isAuthenticated(): boolean {
  return _auth !== null
}

/** Subscribe to auth state changes */
export function onAuthChange(fn: () => void): () => void {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter((l) => l !== fn) }
}

/** Reset for testing */
export function _resetAuth(): void {
  _auth = null
  _activeChannel = null
  _listeners = []
}

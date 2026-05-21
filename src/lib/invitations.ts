// Invitation module — governance proposal invitations via alias
// Admin invites a voter (by alias commitment) to specific proposals.
// Voter sees pending invitations and accepts/rejects with Ed25519 signature.

import {
  apiCreateInvitation,
  apiListInvitations,
  apiRespondInvitation,
  type Invitation,
} from './api'
import { getAuth } from './auth'
import { computeCommitment } from './alias'

export type { Invitation }

// ── Sign payload helpers ────────────────────────────────────────────────

function signPayloadForCreate(toCommitment: string, proposalIds: number[]): string {
  return `${toCommitment}:${proposalIds.join(',')}`
}

function signPayloadForRespond(invitationId: string, accepted: boolean): string {
  return `${invitationId}:${accepted}`
}

// ── Ed25519 signing via extension or WASM ───────────────────────────────

async function signMessage(message: string): Promise<{ signature: string; publicKey: string }> {
  const auth = getAuth()
  if (!auth) throw new Error('No autenticado')

  if (auth.source === 'extension') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cerulean = (window as any).cerulean
    if (!cerulean?.signMessage) throw new Error('Extension no soporta signMessage')
    const result = await cerulean.signMessage(message)
    return { signature: result.signature, publicKey: result.public_key || auth.publicKey }
  }

  // Vault-imported wallet — sign locally with WASM
  const { findWalletByDid, promptPassphrase } = await import('./wallet')
  const wallet = findWalletByDid(auth.did)
  if (!wallet) throw new Error('Wallet no encontrada')

  const pass = promptPassphrase('Ingresa la clave de tu wallet para firmar la invitacion')
  if (!pass) throw new Error('Firma cancelada')

  const { default: init, sign_transaction } = await import('../wasm/cerulean_wallet')
  await init()
  const bytes = new TextEncoder().encode(message)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const signature = sign_transaction(JSON.stringify(wallet.walletFile), pass, hex)
  return { signature, publicKey: auth.publicKey }
}

// ── Public API ──────────────────────────────────────────────────────────

export async function createInvitation(
  toAlias: string,
  proposalIds: number[],
): Promise<{ invitation_id: string }> {
  const auth = getAuth()
  if (!auth) throw new Error('No autenticado')

  const toCommitment = computeCommitment(toAlias)
  const payload = signPayloadForCreate(toCommitment, proposalIds)
  const { signature, publicKey } = await signMessage(payload)

  return apiCreateInvitation({
    from_did: auth.did,
    public_key: publicKey,
    to_commitment: toCommitment,
    proposal_ids: proposalIds,
    signature,
  })
}

export async function listMyInvitations(myAlias: string): Promise<Invitation[]> {
  const commitment = computeCommitment(myAlias)
  return apiListInvitations(commitment)
}

export async function respondInvitation(
  invitationId: string,
  accepted: boolean,
): Promise<{ invitation_id: string; accepted: boolean }> {
  const auth = getAuth()
  if (!auth) throw new Error('No autenticado')

  const payload = signPayloadForRespond(invitationId, accepted)
  const { signature, publicKey } = await signMessage(payload)

  return apiRespondInvitation({
    invitation_id: invitationId,
    public_key: publicKey,
    accepted,
    signature,
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────

export { signPayloadForCreate as _signPayloadForCreate }
export { signPayloadForRespond as _signPayloadForRespond }

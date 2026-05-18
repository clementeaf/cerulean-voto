// QR-based wallet connection for mobile users
// Protocol:
//   1. Voto generates a session ID and shows QR
//   2. QR encodes: wallet.ceruleanledger.com/connect?session=SESSION&node=NODE_URL
//   3. Cerulean Wallet (mobile) scans, user approves, wallet writes identity to node:
//      POST /store/identities { did: "did:cerulean:connect:{session}", public_key: USER_PUBKEY }
//   4. Voto polls GET /store/identities/did:cerulean:connect:{session}
//   5. On response: extract public_key, derive address, verify, authenticate

import { CERULEAN_WALLET_URL } from './wallet'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120000 // 2 minutes

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getNodeUrl(): string {
  // In dev, the proxy target. In production, the actual API URL.
  return window.location.origin
}

export interface QRSession {
  sessionId: string
  connectUrl: string
  sessionDid: string
}

/** Start a new QR connection session */
export function createQRSession(): QRSession {
  const sessionId = generateSessionId()
  const nodeUrl = getNodeUrl()
  const connectUrl = `${CERULEAN_WALLET_URL}/connect?session=${sessionId}&node=${encodeURIComponent(nodeUrl)}`
  const sessionDid = `did:cerulean:connect:${sessionId}`
  return { sessionId, connectUrl, sessionDid }
}

export interface QRConnectResult {
  address: string
  publicKey: string
}

/** Poll the node for a wallet response to the QR session.
 *  Returns when the wallet has written its identity, or null on timeout. */
export async function pollQRSession(session: QRSession, signal?: AbortSignal): Promise<QRConnectResult | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (signal?.aborted) return null

    try {
      const res = await fetch(`${getNodeUrl()}/api/v1/store/identities/${encodeURIComponent(session.sessionDid)}`)
      if (res.ok) {
        const body = await res.json()
        const data = body?.data
        if (data?.public_key) {
          // Derive address from public key
          const pubBytes = new Uint8Array(data.public_key.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)))
          const hash = await crypto.subtle.digest('SHA-256', pubBytes)
          const address = Array.from(new Uint8Array(hash).slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join('')
          return { address, publicKey: data.public_key }
        }
      }
    } catch {
      // Node not reachable or session not found yet — keep polling
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  return null // timeout
}

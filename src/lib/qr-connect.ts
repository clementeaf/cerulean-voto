// QR-based wallet connection for mobile users
// Protocol:
//   1. Voto generates a session ID and shows QR
//   2. QR encodes: wallet.ceruleanledger.com/connect?session=SESSION&node=NODE_URL
//   3. Cerulean Wallet (mobile) scans, user approves, wallet writes public_key to node:
//      PUT /private-data/voto-connect/{session} { value: PUBLIC_KEY_HEX }
//   4. Voto polls GET /private-data/voto-connect/{session}
//   5. On response: extract public_key, derive address, verify, authenticate

import { CERULEAN_WALLET_URL } from './wallet'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120000 // 2 minutes
const COLLECTION = 'voto-connect'

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getNodeUrl(): string {
  return window.location.origin
}

export interface QRSession {
  sessionId: string
  connectUrl: string
}

/** Ensure the private data collection exists (idempotent) */
async function ensureCollection(): Promise<void> {
  try {
    await fetch(`${getNodeUrl()}/api/v1/private-data/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: COLLECTION, member_org_ids: ['voto'] }),
    })
  } catch {
    // Collection may already exist
  }
}

/** Start a new QR connection session */
export async function createQRSession(): Promise<QRSession> {
  await ensureCollection()
  const sessionId = generateSessionId()
  const nodeUrl = getNodeUrl()
  const connectUrl = `${CERULEAN_WALLET_URL}/connect?session=${sessionId}&node=${encodeURIComponent(nodeUrl)}`
  return { sessionId, connectUrl }
}

export interface QRConnectResult {
  address: string
  publicKey: string
}

/** Poll the node for a wallet response to the QR session.
 *  Returns when the wallet has written its public key, or null on timeout/cancel. */
export async function pollQRSession(session: QRSession, signal?: AbortSignal): Promise<QRConnectResult | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (signal?.aborted) return null

    try {
      const res = await fetch(
        `${getNodeUrl()}/api/v1/private-data/${COLLECTION}/${encodeURIComponent(session.sessionId)}`,
        { headers: { 'X-Org-Id': 'voto' } },
      )
      if (res.ok) {
        const body = await res.json()
        const publicKey = body?.data?.value
        if (publicKey && typeof publicKey === 'string' && publicKey.length >= 32) {
          // Derive address from public key
          const pubBytes = new Uint8Array(publicKey.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)))
          const hash = await crypto.subtle.digest('SHA-256', pubBytes)
          const address = Array.from(new Uint8Array(hash).slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join('')
          return { address, publicKey }
        }
      }
    } catch {
      // Not found yet or node unreachable — keep polling
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  return null
}

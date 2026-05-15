// Wallet integration — uses cerulean-wallet WASM for real Ed25519 crypto
// Same Argon2id + AES-256-GCM as the CLI. Wallets are cross-compatible.

import init, {
  generate_wallet,
  sign_transaction,
} from '../wasm/cerulean_wallet'

let wasmReady = false

async function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    await init()
    wasmReady = true
  }
}

// -- Types ------------------------------------------------------------------

export interface WalletFile {
  version: number
  algorithm: string
  address: string
  public_key: string
  private_key: {
    type: 'Encrypted'
    ciphertext: string
    salt: string
    nonce: string
  }
}

export interface StoredWallet {
  name: string
  walletFile: WalletFile
  created_at: number
}

// -- DID derivation ---------------------------------------------------------

/** Derive a deterministic DID from a public key (same as wallet address). */
export function didFromPublicKey(publicKey: string): string {
  return `did:cerulean:${publicKey.slice(0, 40)}`
}

/** Derive a deterministic DID from a wallet file. */
export function didFromWallet(wallet: WalletFile): string {
  return didFromPublicKey(wallet.public_key)
}

// -- Wallet generation (WASM) -----------------------------------------------

/** Generate a real Ed25519 wallet. Returns encrypted wallet file. */
export async function createWallet(passphrase: string): Promise<WalletFile> {
  await ensureWasm()
  const json = generate_wallet(passphrase)
  return JSON.parse(json) as WalletFile
}

// -- Vote signing (WASM) ----------------------------------------------------

/** Build a vote signing payload and sign it with the wallet's private key. */
export async function signVote(
  walletFile: WalletFile,
  passphrase: string,
  payload: { proposal_id: number; option: string },
): Promise<string> {
  await ensureWasm()
  // Payload format: "vote:{proposal_id}:{option}:{public_key}"
  const message = `vote:${payload.proposal_id}:${payload.option}:${walletFile.public_key}`
  const bytes = new TextEncoder().encode(message)
  const payloadHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const walletJson = JSON.stringify(walletFile)
  return sign_transaction(walletJson, passphrase, payloadHex)
}

// -- localStorage persistence ------------------------------------------------

const WALLETS_KEY = 'cv_wallets'

export function getStoredWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(WALLETS_KEY)
    return raw ? JSON.parse(raw) as StoredWallet[] : []
  } catch {
    return []
  }
}

export function storeWallet(name: string, walletFile: WalletFile): StoredWallet {
  const list = getStoredWallets()
  const entry: StoredWallet = { name, walletFile, created_at: Date.now() }
  localStorage.setItem(WALLETS_KEY, JSON.stringify([...list, entry]))
  return entry
}

export function findWalletByName(name: string): StoredWallet | undefined {
  const normalized = name.trim().toLowerCase()
  return getStoredWallets().find(w => w.name.toLowerCase() === normalized)
}

export function deleteStoredWallet(address: string): void {
  const list = getStoredWallets().filter(w => w.walletFile.address !== address)
  localStorage.setItem(WALLETS_KEY, JSON.stringify(list))
}

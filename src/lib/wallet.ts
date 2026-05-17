// Wallet integration — uses cerulean-wallet WASM for real Ed25519 crypto
// Wallet = keypair (no name). Name is assigned in the padron, not the wallet.

import init, {
  generate_wallet,
  sign_transaction,
} from '../wasm/cerulean_wallet'
import { vaultStore, vaultGet, registerIdentity } from './api'

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

/** A wallet cached locally. Name is optional — assigned when added to padron. */
export interface StoredWallet {
  name: string               // Padron label (empty if not in any padron yet)
  walletFile: WalletFile
  created_at: number
}

// -- DID derivation ---------------------------------------------------------

/** Derive DID from wallet address (sha256(pubkey)[0..20] hex). */
export function didFromAddress(address: string): string {
  return `did:cerulean:${address}`
}

/** Derive DID from public key by computing the address (sha256). */
export async function didFromPublicKey(publicKey: string): Promise<string> {
  const bytes = new Uint8Array(publicKey.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const address = Array.from(new Uint8Array(hash).slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `did:cerulean:${address}`
}

/** Derive DID from wallet file using the pre-computed address. */
export function didFromWallet(wallet: WalletFile): string {
  return didFromAddress(wallet.address)
}

// -- Wallet generation (WASM) — no name, just crypto -------------------------

/** Generate a real Ed25519 wallet. No name — pure keypair. */
export async function createWallet(passphrase: string): Promise<WalletFile> {
  await ensureWasm()
  const json = generate_wallet(passphrase)
  return JSON.parse(json) as WalletFile
}

/** Create wallet + register DID on-chain + store in vault. No name. */
export async function createAndRegisterWallet(passphrase: string): Promise<{ walletFile: WalletFile; did: string }> {
  const walletFile = await createWallet(passphrase)
  const did = didFromWallet(walletFile)

  // Register DID on-chain
  await registerIdentity({ did, public_key: walletFile.public_key })

  // Backup encrypted wallet to vault
  await vaultStore(did, { walletFile, created_at: Date.now() })

  // Cache locally (no name yet)
  cacheWallet('', walletFile)

  return { walletFile, did }
}

// -- Vote signing (WASM) ----------------------------------------------------

export async function signVote(
  walletFile: WalletFile,
  passphrase: string,
  payload: { proposal_id: number; option: string },
): Promise<string> {
  await ensureWasm()
  const message = `vote:${payload.proposal_id}:${payload.option}:${walletFile.public_key}`
  const bytes = new TextEncoder().encode(message)
  const payloadHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const walletJson = JSON.stringify(walletFile)
  return sign_transaction(walletJson, passphrase, payloadHex)
}

/** Prompt for passphrase ephemerally — never stored in component state.
 *  Returns null if user cancels. */
export function promptPassphrase(label = 'Ingresa la clave de tu wallet'): string | null {
  return window.prompt(label)
}

/** Sign a vote with ephemeral passphrase prompt. Returns null if cancelled. */
export async function signVoteWithPrompt(
  walletFile: WalletFile,
  payload: { proposal_id: number; option: string },
): Promise<string | null> {
  const pass = promptPassphrase()
  if (!pass) return null
  try {
    return await signVote(walletFile, pass, payload)
  } finally {
    // pass is a local variable — goes out of scope here, no zeroing needed
    // but we ensure it's never assigned to any persistent reference
  }
}

/** Verify passphrase by signing a test payload. Throws on wrong passphrase. */
export async function verifyPassphrase(walletFile: WalletFile, passphrase: string): Promise<void> {
  await signVote(walletFile, passphrase, { proposal_id: 0, option: 'auth-verify' })
}

// -- Local cache (sessionStorage — dies with tab, vault = source of truth) ----

const CACHE_KEY = 'cv_wallets'

function readCache(): StoredWallet[] {
  try {
    // sessionStorage — wallet keys die with the tab. Vault is source of truth.
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) as StoredWallet[] : []
  } catch {
    return []
  }
}

function writeCache(wallets: StoredWallet[]): void {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(wallets))
}

/** Migrate any wallets left in localStorage from pre-0.2.0 into sessionStorage, then wipe localStorage copy. */
export function migrateWalletCache(): void {
  try {
    const legacy = localStorage.getItem(CACHE_KEY)
    if (legacy) {
      const existing = readCache()
      if (existing.length === 0) {
        sessionStorage.setItem(CACHE_KEY, legacy)
      }
      localStorage.removeItem(CACHE_KEY)
    }
  } catch { /* ignore */ }
}

function cacheWallet(name: string, walletFile: WalletFile): StoredWallet {
  const entry: StoredWallet = { name, walletFile, created_at: Date.now() }
  const list = readCache()
  if (!list.some(w => w.walletFile.address === walletFile.address)) {
    writeCache([...list, entry])
  }
  return entry
}

// -- Padron operations (name assignment) -------------------------------------

/** Assign a name to a cached wallet (when admin adds to padron). */
export function assignName(did: string, name: string): void {
  const list = readCache().map(w =>
    didFromWallet(w.walletFile) === did ? { ...w, name } : w,
  )
  writeCache(list)
}

// -- Queries ----------------------------------------------------------------

export function getStoredWallets(): StoredWallet[] {
  return readCache()
}

export function findWalletByName(name: string): StoredWallet | undefined {
  const normalized = name.trim().toLowerCase()
  return readCache().find(w => w.name.toLowerCase() === normalized)
}

export function findWalletByDid(did: string): StoredWallet | undefined {
  return readCache().find(w => didFromWallet(w.walletFile) === did)
}

export function deleteStoredWallet(address: string): void {
  writeCache(readCache().filter(w => w.walletFile.address !== address))
}

// -- Vault import ------------------------------------------------------------

/** Pull a wallet from vault by DID and add to local cache. */
export async function importFromVault(did: string): Promise<StoredWallet | null> {
  const result = await vaultGet(did)
  if (!result?.encrypted_wallet) return null

  const vaultData = result.encrypted_wallet as { walletFile?: WalletFile; name?: string; created_at?: number }
  if (!vaultData.walletFile?.address) return null

  const entry: StoredWallet = {
    name: vaultData.name || '',
    walletFile: vaultData.walletFile,
    created_at: vaultData.created_at || Date.now(),
  }

  const list = readCache()
  if (!list.some(w => w.walletFile.address === entry.walletFile.address)) {
    writeCache([...list, entry])
  }

  return entry
}

// -- Legacy aliases (backward compat for components not yet migrated) --------

export function storeWallet(name: string, walletFile: WalletFile): StoredWallet {
  return cacheWallet(name, walletFile)
}

export async function registerAndStoreWallet(name: string, walletFile: WalletFile): Promise<StoredWallet> {
  const did = didFromWallet(walletFile)
  await registerIdentity({ did, public_key: walletFile.public_key })
  await vaultStore(did, { name, walletFile, created_at: Date.now() })
  return cacheWallet(name, walletFile)
}

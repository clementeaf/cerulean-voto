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

export function didFromPublicKey(publicKey: string): string {
  return `did:cerulean:${publicKey.slice(0, 40)}`
}

export function didFromWallet(wallet: WalletFile): string {
  return didFromPublicKey(wallet.public_key)
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

// -- Local cache (localStorage = cache, vault = source of truth) -------------

const CACHE_KEY = 'cv_wallets'

function readCache(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) as StoredWallet[] : []
  } catch {
    return []
  }
}

function writeCache(wallets: StoredWallet[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(wallets))
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

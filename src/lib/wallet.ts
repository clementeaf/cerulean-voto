// Wallet integration — uses cerulean-wallet WASM for real Ed25519 crypto
// Wallets are stored on-chain via /vault endpoints. localStorage is a cache.

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

export interface StoredWallet {
  name: string
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

// -- Wallet generation (WASM) -----------------------------------------------

export async function createWallet(passphrase: string): Promise<WalletFile> {
  await ensureWasm()
  const json = generate_wallet(passphrase)
  return JSON.parse(json) as WalletFile
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

// -- On-chain persistence (vault) + localStorage cache ----------------------

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

/** Register a new wallet: blockchain identity + vault backup + local cache. */
export async function registerAndStoreWallet(name: string, walletFile: WalletFile): Promise<StoredWallet> {
  const did = didFromWallet(walletFile)

  // 1. Register identity on-chain (DID + public key)
  await registerIdentity({
    did,
    public_key: walletFile.public_key,
    metadata: { voter_name: name, address: walletFile.address },
  })

  // 2. Store encrypted wallet on-chain (vault backup)
  await vaultStore(did, { name, walletFile, created_at: Date.now() })

  // 3. Cache locally
  const entry: StoredWallet = { name, walletFile, created_at: Date.now() }
  const list = readCache()
  if (!list.some(w => w.walletFile.address === walletFile.address)) {
    writeCache([...list, entry])
  }

  return entry
}

/** Get wallets from local cache. Call syncFromVault() to refresh from chain. */
export function getStoredWallets(): StoredWallet[] {
  return readCache()
}

/** Pull a wallet from vault by DID and add to local cache. */
export async function importFromVault(did: string): Promise<StoredWallet | null> {
  const result = await vaultGet(did)
  if (!result?.encrypted_wallet) return null

  const vaultData = result.encrypted_wallet as StoredWallet
  if (!vaultData.walletFile?.address) return null

  const list = readCache()
  if (!list.some(w => w.walletFile.address === vaultData.walletFile.address)) {
    writeCache([...list, vaultData])
  }

  return vaultData
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

// Legacy alias — components that call storeWallet still work
export function storeWallet(name: string, walletFile: WalletFile): StoredWallet {
  const entry: StoredWallet = { name, walletFile, created_at: Date.now() }
  const list = readCache()
  if (!list.some(w => w.walletFile.address === walletFile.address)) {
    writeCache([...list, entry])
  }
  return entry
}

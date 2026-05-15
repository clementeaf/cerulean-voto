/* tslint:disable */
/* eslint-disable */

/**
 * Decrypt a private key from a wallet JSON string.
 * Returns the raw private key as hex (caller uses it for signing).
 */
export function decrypt_wallet(wallet_json: string, passphrase: string): string;

/**
 * Derive a new address from an HD wallet.
 * Returns JSON: { "index": N, "path": "...", "address": "...", "public_key": "..." }
 */
export function derive_hd_address(wallet_json: string, passphrase: string, index: number): string;

/**
 * Generate a new HD wallet with a 24-word mnemonic.
 * Returns a JSON object: { "mnemonic": "...", "wallet": { ... } }
 *
 * The frontend MUST display the mnemonic once, have the user confirm,
 * then discard it — it is never stored.
 */
export function generate_hd_wallet(passphrase: string): string;

/**
 * Generate a new Ed25519 wallet, encrypt the private key with the passphrase,
 * and return a JSON string matching the CLI wallet file format.
 */
export function generate_wallet(passphrase: string): string;

/**
 * Recover an HD wallet from a mnemonic phrase.
 * Returns wallet JSON (v2 format).
 */
export function recover_hd_wallet(mnemonic_words: string, passphrase: string): string;

/**
 * Sign a transaction payload.
 *
 * Takes the wallet JSON, passphrase, and the signing payload (hex-encoded).
 * Returns the Ed25519 signature as hex.
 *
 * The caller builds the signing payload from the transaction fields
 * (matching rust-bc's NativeTransaction::signing_payload format).
 */
export function sign_transaction(wallet_json: string, passphrase: string, payload_hex: string): string;

/**
 * Validate a 24-word BIP-39 mnemonic. Returns true if valid.
 */
export function validate_mnemonic_words(mnemonic: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly decrypt_wallet: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly derive_hd_address: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly generate_hd_wallet: (a: number, b: number) => [number, number, number, number];
    readonly generate_wallet: (a: number, b: number) => [number, number, number, number];
    readonly recover_hd_wallet: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly sign_transaction: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly validate_mnemonic_words: (a: number, b: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

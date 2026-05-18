# Changelog

## [0.4.0] - 2026-05-17

### Added

- **Extension vote signing**: `window.cerulean.signVote(proposalId, option)` delegates signing to the Chrome extension popup. Falls back to local WASM for vault-imported wallets.
- **Extension verification**: on connect, verifies `sha256(publicKey)[0..20] === address` to catch rogue extensions impersonating Cerulean Wallet.
- **Auth source tracking**: auth state tracks `source` (extension/vault/address-only) to choose the correct signing path.
- **CSP meta tag**: restricts scripts, styles, connections, and fonts to trusted origins.

### Changed

- **Wallet creation removed from Voto** — delegated to Cerulean Wallet (`wallet.ceruleanledger.com`). Setup and Voters pages redirect users to create wallets externally.
- WASM retained for vote signing only, not wallet generation.
- Voters page: inscription by address/DID only, no local wallet generation.

### Security

- **founder_did tamper protection**: `isFounder()` and `getRoleInScope()` cross-check localStorage founder_did against the authenticated wallet DID. `saveOrgSettings` rejects founder_did that doesn't match authenticated user.
- **Wallet cache cleared on disconnect**: `authDisconnect()` wipes sessionStorage wallet keys to minimize XSS exposure window.

### Fixed

- Extension-connected wallets had placeholder ciphertext and couldn't sign locally — now routes to extension `signVote` instead.
- Client-side ID generation for POST requests (backend requires `id` in body).
- PUT endpoints use fetch-merge-put pattern (backend requires full object).
- Assembly field mapping: frontend `type` to backend `assembly_type`.
- Setup wires `authConnect` after wallet creation so subsequent API calls pass the interceptor.

## [0.3.0] - 2026-05-17

### Security

- **Ephemeral passphrase**: vote signing uses prompt-and-discard pattern, never stored in React state.
- **sessionStorage wallet cache**: encrypted keys die with browser tab. Vault on-chain is source of truth.
- **Nonce-salted blind voter ID**: random 16-byte nonce prevents reverse-mapping from public padron.
- **In-memory channel ID**: active scope channel cannot be tampered via DevTools.
- **Input validation**: required fields, enums, and type checks before API calls.

### Removed

- localStorage data export/import from Admin page.

## [0.2.0] - 2026-05-17

### Added

- **API-backed persistence**: all entities persist via Cerulean Ledger `/store/*` endpoints (RocksDB).
- **Full CRUD**: scopes, assemblies, sessions, actas — POST, GET, GET/{id}, PUT/{id}, DELETE/{id}.
- **Auth module**: in-memory wallet authentication with Ed25519 verification. Auth gate in Layout.
- **Role-derived headers**: `X-Msp-Role` from connected user's actual role, not hardcoded.
- **Test suite**: 50 tests (Vitest + happy-dom) covering store, permissions, auth.

### Fixed

- `X-Msp-Role: admin` hardcoded on every request.
- No authentication existed.
- Permissions were client-side only.

## [0.1.0] - 2026-05-16

Initial release.

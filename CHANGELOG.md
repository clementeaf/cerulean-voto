# Changelog

## [0.7.0] - 2026-05-21

### Added

- **Solicitud flow (role requests)**: unified "search by alias → send request → accept/decline" pattern for scope role assignments.
- `ScopeMember.status` field: `'active' | 'pending'` — pending members await acceptance before role takes effect.
- **Scopes page**: alias search replaces dropdown for adding members. Admin resolves alias → member added as `pending` with chosen role.
- **Layout banner**: logged-in users see pending solicitudes across all scopes with accept/decline buttons. On accept, role activates; on decline, member removed.
- `getPendingSolicitudes()`, `acceptSolicitud()`, `declineSolicitud()` in store.
- Invitation API wrappers in `api.ts` for future Ledger integration.

### Changed

- Scopes member addition uses alias resolution instead of wallet dropdown.
- Voters page "Invitar por alias" simplified back to "Inscribir por alias" (resolve + inscribe, no proposal coupling).

## [0.6.0] - 2026-05-21

### Added

- **Alias resolution**: zero-knowledge alias lookup via SHA3-256 commitments. `src/lib/alias.ts` computes commitment client-side, resolves via `POST /api/v1/alias/resolve`.
- **Invite by alias**: new section in Voters page to resolve an alias and auto-inscribe the participant.
- **Alias display**: resolved aliases appear as `@alias` badge in the padron electoral.
- 25 unit tests for alias validation, normalization, commitment, cache, and resolution.

### Dependencies

- Added `js-sha3` for SHA3-256 (FIPS 202).

## [0.5.0] - 2026-05-20

### Added

- **Mobile-to-mobile wallet connection**: redirect-based flow for users on mobile where QR scanning is not possible. Voto redirects to Cerulean Wallet PWA with a session ID; Wallet approves and writes the public key to the node relay; Voto reads it on callback and authenticates.
- **Mobile detection**: `isMobileBrowser()` in `qr-connect.ts`. AuthGate shows "Conectar" (redirect) on mobile, "QR Celular" on desktop.
- **E2E test suite**: Playwright with Chromium — 7 tests covering desktop QR tab, mobile redirect tab, wallet URL structure, callback auto-authentication, and expired session handling.

### Changed

- AuthGate tabs are now context-aware: extension (if detected), QR (desktop), redirect (mobile), and vault import (always).

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

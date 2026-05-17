# Changelog

## [0.3.0] - 2026-05-17

### Security

- **Ephemeral passphrase**: wallet passphrase is no longer stored in React state. Vote signing uses `signVoteWithPrompt()` — passphrase is prompted, used, and discarded in a single call. Auth gate clears passphrase immediately after verification.
- **sessionStorage wallet cache**: encrypted private keys moved from localStorage to sessionStorage — die with the browser tab. Vault on-chain remains source of truth. Legacy localStorage wallets auto-migrated on startup.
- **Nonce-salted blind voter ID**: each vote includes a random 16-byte nonce in the signed payload. `sha256(proposal_id || voter_did || nonce)` prevents reverse-mapping voter identity from the public padron.
- **In-memory channel ID**: active scope channel moved from localStorage to auth module (memory-only). Cannot be tampered via DevTools to access other DLT channels.
- **Input validation**: required fields, enum constraints, and type checks enforced in all store save functions before payloads reach the backend.

### Removed

- localStorage data export/import from Admin page — all data is now on-chain.

## [0.2.0] - 2026-05-17

### Added

- **API-backed persistence**: scopes, assemblies, sessions, and actas persist via Cerulean Ledger `/store/*` endpoints (RocksDB) instead of localStorage.
- **Full CRUD**: all 4 entities support POST, GET, GET/{id}, PUT/{id}, DELETE/{id} through `api.ts`.
- **Auth module** (`src/lib/auth.ts`): in-memory wallet authentication with Ed25519 passphrase verification. Auth state never touches localStorage.
- **Auth gate**: Layout requires wallet connection before accessing any app route. Supports local wallets and Chrome extension.
- **Role-derived headers**: `X-Msp-Role` derived from the connected user's actual role (admin/member/observer), no longer hardcoded.
- **Request blocking**: unauthenticated requests to protected endpoints are rejected by the interceptor.
- **Test suite**: Vitest + happy-dom with 50 tests covering store CRUD, permissions engine, convocatoria validation, and auth module.

### Changed

- `store.ts` uses in-memory cache populated by `fetch*()` calls. Sync getters read from cache for permissions engine.
- `api.ts` interceptor reads org config directly from localStorage (breaks circular dependency with store).
- OrgSettings and active scope remain in localStorage as local connection config.
- Scopes page uses authenticated DID instead of manual user selector.

### Fixed

- `X-Msp-Role: admin` was hardcoded on every request — now derived from auth.
- No authentication existed — wallet verification now required.
- Permissions were client-side only — headers now carry real roles for server-side enforcement in strict mode.

## [0.1.0] - 2026-05-16

Initial release. localStorage-backed voting platform with Ed25519 signing, scopes, assemblies, sessions, and actas.

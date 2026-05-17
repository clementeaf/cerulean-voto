# Changelog

## [0.2.0] - 2026-05-17

### Added
- **API-backed persistence**: scopes, assemblies, sessions, and actas now persist via Cerulean Ledger `/store/*` endpoints (RocksDB) instead of localStorage.
- **Full CRUD**: all 4 entities support POST, GET, GET/{id}, PUT/{id}, DELETE/{id} through `api.ts`.
- **Auth module** (`src/lib/auth.ts`): in-memory wallet authentication with Ed25519 passphrase verification. Auth state never touches localStorage.
- **Auth gate**: Layout requires wallet connection before accessing any app route. Supports local wallets and Chrome extension.
- **Role-derived headers**: `X-Msp-Role` is derived from the connected user's actual role (admin/member/observer), no longer hardcoded.
- **Request blocking**: unauthenticated requests to protected endpoints are rejected by the interceptor.
- **Test suite**: Vitest + happy-dom with 50 tests covering store CRUD, permissions engine, convocatoria validation, and auth module.

### Changed
- `store.ts` uses in-memory cache populated by `fetch*()` calls. Sync getters (`getScopes()`, etc.) read from cache for permissions engine.
- `api.ts` interceptor reads org config directly from localStorage (breaks circular dependency with store).
- OrgSettings and active scope remain in localStorage as local connection config.
- Scopes page uses authenticated DID instead of manual user selector.

### Fixed
- `X-Msp-Role: admin` was hardcoded on every request — now derived from auth.
- No authentication existed — wallet verification now required.
- Permissions were client-side only — headers now carry real roles for server-side enforcement in strict mode.

## [0.1.0] - 2026-05-16

Initial release. localStorage-backed voting platform with Ed25519 signing, scopes, assemblies, sessions, and actas.

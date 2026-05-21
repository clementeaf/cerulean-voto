# Changelog

## [0.7.0] - 2026-05-21

### Added

- **Solicitud flow**: search by alias → send request → accept/decline. Admin adds members to scopes as `pending`; invitee accepts or declines via banner in Layout.
- `ScopeMember.status`: `'active' | 'pending'` field for request-based membership.
- `getPendingSolicitudes()`, `acceptSolicitud()`, `declineSolicitud()` in store.
- Invitation API wrappers in `api.ts` for future Ledger integration.

### Changed

- **Sidebar consolidated**: 10 items → 7. Merged Dashboard, Vote, Results into single Elections page.
- **Elections page**: unified view — create, vote, tally, and results in one page.
- **Voters page**: simplified to single input with alias/address mode toggle.
- **Scopes page**: alias search replaces wallet dropdown for member addition.
- Removed `/dashboard`, `/vote`, `/results` routes (redirect to `/elections`).

### Fixed

- CloudFront proxy: `/api/*` now routes to Cerulean Ledger backend (`ceruleanledger.com`).
- SPA routing via CloudFront Function (replaces error-page fallback that broke API proxy).
- Added redirects for removed routes to prevent blank pages.

## [0.6.0] - 2026-05-21

### Added

- **Alias resolution**: zero-knowledge alias lookup via SHA3-256 commitments.
- **Alias display**: resolved aliases appear as `@alias` badge in voter lists.
- 25 unit tests for alias module.

### Dependencies

- Added `js-sha3` for SHA3-256 (FIPS 202).

## [0.5.0] - 2026-05-20

### Added

- **Mobile-to-mobile wallet connection**: redirect flow for mobile users.
- **Mobile detection**: AuthGate shows "Conectar" (redirect) on mobile, "QR Celular" on desktop.
- **E2E test suite**: Playwright with Chromium — 7 tests.

## [0.4.0] - 2026-05-17

### Added

- **Extension vote signing** via `window.cerulean.signVote()`.
- **Extension verification**: `sha256(publicKey)[0..20] === address`.
- **Auth source tracking**: extension/vault/address-only.
- **CSP meta tag**.

### Changed

- Wallet creation delegated to Cerulean Wallet.

### Security

- founder_did tamper protection.
- Wallet cache cleared on disconnect.

### Fixed

- Extension signing path, client-side ID generation, PUT fetch-merge pattern, assembly field mapping.

## [0.3.0] - 2026-05-17

### Security

- Ephemeral passphrase, sessionStorage wallet cache, nonce-salted blind voter ID, in-memory channel ID, input validation.

## [0.2.0] - 2026-05-17

### Added

- API-backed persistence via Cerulean Ledger `/store/*` endpoints.
- Full CRUD for scopes, assemblies, sessions, actas.
- Auth module with Ed25519 verification.
- 50 unit tests.

## [0.1.0] - 2026-05-16

Initial release.

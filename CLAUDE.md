# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on http://localhost:5174 (proxies /api → node)
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # Preview production build
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

Sandbox node runs on port 9600. Set via `.env`: `VITE_API_PROXY_TARGET=http://127.0.0.1:9600`

Production: `VITE_API_PROXY_TARGET=https://api.ceruleanledger.com`

## Architecture

**On-chain voting platform** for the Cerulean Ledger ecosystem. Spanish-language UI for Chilean community organizations (Ley 19.418).

### Data Flow

- **On-chain** (scopes, assemblies, sessions, actas, governance, identity, vault) → `src/lib/api.ts` → Cerulean Ledger (RocksDB)
- **Local config** (org settings, active scope ID) → localStorage (`cv_` prefix)
- **Cache** → `store.ts` module-level variables, populated by `fetch*()`, read synchronously by permissions engine
- **Auth** → `src/lib/auth.ts`, in-memory only
- **Wallet cache** → sessionStorage (dies with tab), vault on-chain is source of truth
- **Signing** → WASM for vault-imported wallets, Chrome extension for extension-connected wallets

### Auth Flow

1. User connects wallet in Layout auth gate: extension (`window.cerulean`), vault import, or redirect to `wallet.ceruleanledger.com` to create
2. Extension connections verified: `sha256(publicKey)[0..20] === address`
3. `auth.ts` stores DID, address, publicKey, role, and source (extension/vault) in memory
4. Interceptor injects `X-Msp-Role` from auth, blocks unauthenticated requests to protected endpoints
5. Public paths (no auth needed): `/health`, `/channels`, `/store/identities`, `/vault`
6. Standalone routes (no auth gate): `/` (Landing), `/setup` (wizard — authenticates after step 1)

### Wallet Integration

Voto does **not** generate wallets — that's Cerulean Wallet's responsibility.

- **Extension**: `window.cerulean.connect()` → `{ address, publicKey }`. Signing: `window.cerulean.signVote(proposalId, option)` → `{ signature, public_key }`
- **Vault import**: pull wallet from on-chain vault by DID. Signing: local WASM with ephemeral passphrase prompt
- **No wallet**: redirect to `wallet.ceruleanledger.com`

### Permissions

- `isVerifiedFounder()` cross-checks localStorage `founder_did` against authenticated wallet DID
- Admin role propagates down scope tree; voter/observer do not
- `saveOrgSettings()` validates that `founder_did` matches the authenticated user
- `X-Msp-Role` header carries the real role for server-side enforcement in strict mode

### API Conventions

- Backend requires client-generated `id` and `created_at` on POST
- PUT requires full object body — `apiUpdate*` functions fetch current state, merge patch, then PUT
- Assembly field mapping: frontend `type` ↔ backend `assembly_type` (mapped in `api.ts`)
- Response envelope: `{ status: "Success", data: T }` — unwrapped by `unwrap<T>()`

### API Modules

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| Scopes | `CRUD /store/scopes` | Organizational units |
| Assemblies | `CRUD /store/assemblies` | Assemblies (filter: `?scope_id=`) |
| Sessions | `CRUD /store/sessions` | Sessions (filter: `?assembly_id=`) |
| Actas | `CRUD /store/actas` | Permanent records |
| Channels | `POST /channels` | DLT channel creation |
| Governance | `/governance/proposals`, `.../vote`, `.../tally` | Elections |
| Identity | `/store/identities` | DID registration (public) |
| Vault | `/vault/store`, `/vault/{did}` | Wallet backup (public) |

### Testing

- Vitest + happy-dom, configured in `vite.config.ts`
- `src/test-setup.ts` — localStorage polyfill for Node 22+
- Store tests mock `./api` with `vi.mock()` — test cache + validation, not HTTP
- Auth tests verify role derivation, founder cross-check, connect/disconnect
- 50 tests covering store CRUD, permissions, convocatoria validation, auth

### Security

- CSP meta tag in `index.html` restricts scripts, styles, connections
- Wallet keys in sessionStorage (not localStorage) — cleared on disconnect
- Passphrase never in React state — ephemeral prompt or extension popup
- Blind voter ID salted with random 16-byte nonce
- Channel ID in memory (auth module), not localStorage
- Extension identity verified via address derivation check

## Conventions

- UI text in Spanish
- localStorage: only `cv_org_settings` and `cv_active_scope`
- Immutable updates in store (spread + map)
- ISO 8601 dates, correlative folio counters
- WASM for signing only, not wallet generation
- Auth state is memory-only

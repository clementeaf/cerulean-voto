# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on http://localhost:5174 (proxies /api → node)
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # Preview production build
npm test             # Vitest unit tests (run once)
npm run test:watch   # Vitest unit tests (watch mode)
npm run test:e2e     # Playwright E2E tests (Chromium)
```

## Deployment

```bash
npm run build
aws s3 sync dist/ s3://ceruleanledger-voto --delete
aws cloudfront create-invalidation --distribution-id E2QW638B59JZ89 --paths "/*"
```

- **Frontend**: S3 bucket `ceruleanledger-voto` + CloudFront `E2QW638B59JZ89`
- **Domain**: `voto.ceruleanledger.com`
- **API proxy**: CloudFront routes `/api/*` → `ceruleanledger.com` (same backend as Explorer)
- **SPA routing**: CloudFront Function `voto-spa-rewrite` rewrites non-asset, non-API paths to `/index.html`
- **Dev proxy**: Vite forwards `/api/*` to `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:9600`)

## Architecture

**On-chain voting platform** for the Cerulean Ledger ecosystem. Spanish-language UI for Chilean community organizations (Ley 19.418).

### Pages (7 routes)

| Group | Route | Page | Purpose |
|-------|-------|------|---------|
| Votacion | `/elections` | Elections | Create, vote, tally, results — all in one |
| Votacion | `/voters` | Padron | Inscribe voters by alias or address |
| Organizacion | `/scopes` | Estructura | Org units, members, roles via alias solicitud |
| Organizacion | `/assemblies` | Asambleas | Ordinary/extraordinary assemblies |
| Organizacion | `/sessions` | Sesiones | Session management, agenda, attendance |
| Organizacion | `/actas` | Actas | Permanent records with integrity hash |
| Admin | `/admin` | Administracion | Org settings, DLT channel, legal compliance |

Standalone: `/` (Landing), `/setup` (wizard)

### Data Flow

- **On-chain** (scopes, assemblies, sessions, actas, governance, identity, vault) → `src/lib/api.ts` → Cerulean Ledger (RocksDB)
- **Local config** (org settings, active scope ID) → localStorage (`cv_` prefix)
- **Cache** → `store.ts` module-level variables, populated by `fetch*()`, read synchronously by permissions engine
- **Auth** → `src/lib/auth.ts`, in-memory only
- **Wallet cache** → sessionStorage (dies with tab), vault on-chain is source of truth
- **Signing** → WASM for vault-imported wallets, Chrome extension for extension-connected wallets

### Auth Flow

1. User connects wallet in Layout auth gate: extension (`window.cerulean`), mobile redirect, QR scan, vault import
2. Extension connections verified: `sha256(publicKey)[0..20] === address`
3. `auth.ts` stores DID, address, publicKey, role, and source in memory
4. Interceptor injects `X-Msp-Role`, `X-Channel-Id`, `X-Org-Id` headers
5. Public paths (no auth): `/health`, `/channels`, `/store/identities`, `/vault`

### Solicitudes (Role Requests)

Unified "search by alias → send request → accept/decline" pattern for scope membership.

- `ScopeMember.status`: `'active' | 'pending'`
- **Scopes page**: admin resolves alias → adds member as `pending` with chosen role
- **Layout banner**: invitee sees pending solicitudes → accept/decline
- On accept: status → `active`, role takes effect
- On decline: member removed

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
| Alias | `POST /alias/resolve` | Zero-knowledge alias → DID resolution |
| Invitations | `POST /governance/invitations`, `GET ...?voter=X`, `POST .../respond` | Governance invitations via alias |

### Alias System

Zero-knowledge alias resolution. Plaintext never leaves the client.

- `src/lib/alias.ts` — normalize, validate, compute commitment, resolve, cache
- Commitment = `SHA3-256(salt + alias)` where salt = `SHA3-256("cerulean:alias:salt:" + alias)[0..16]`
- API: `POST /api/v1/alias/resolve { commitment }` → `{ did, address }` or null
- Validation: `[\p{L}\p{N}_-]{3,32}` (Unicode-safe, XSS-safe)

### Testing

- **Unit**: Vitest + happy-dom. 94 tests covering store, permissions, auth, alias, invitations
- **E2E**: Playwright + Chromium. 7 tests covering AuthGate, wallet connect, callbacks
- Store tests mock `./api` with `vi.mock()` — test cache + validation, not HTTP
- E2E tests mock `/api/**` via `page.route()` — no real backend needed

### Security

- CSP meta tag restricts scripts, styles, connections
- Wallet keys in sessionStorage — cleared on disconnect
- Passphrase never in React state — ephemeral prompt or extension popup
- Blind voter ID salted with random 16-byte nonce
- Extension identity verified via address derivation check

## Conventions

- UI text in Spanish
- localStorage: only `cv_org_settings` and `cv_active_scope`
- Immutable updates in store (spread + map)
- ISO 8601 dates, correlative folio counters
- WASM for signing only, not wallet generation
- Auth state is memory-only

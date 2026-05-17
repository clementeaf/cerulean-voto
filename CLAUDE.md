# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on http://localhost:5174 (proxies /api → local node)
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # Preview production build locally
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

To target a remote node: `VITE_API_PROXY_TARGET=https://api.ceruleanledger.com npm run dev`

Requires a Cerulean Ledger node at `http://127.0.0.1:8080` for API calls.

## Architecture

**Multi-tenant on-chain voting platform** for the Cerulean Ledger ecosystem. Spanish-language UI targeting Chilean community organizations (Ley 19.418 compliance).

### Data Flow

- **On-chain state** (scopes, assemblies, sessions, actas, governance, identity, vault) → Axios client in `src/lib/api.ts` via `/api/v1` proxy → persisted in Cerulean Ledger (RocksDB)
- **Local config** (org settings, active scope) → localStorage via `src/lib/store.ts` (keys prefixed `cv_`)
- **In-memory cache** → `store.ts` module-level variables populated by `fetch*()` calls, read synchronously by permissions engine
- **Auth state** → `src/lib/auth.ts`, in-memory only (never localStorage)
- **Crypto** (Ed25519 keypairs, signing) → WASM module in `src/wasm/` loaded by `src/lib/wallet.ts`

### Auth Flow

1. User connects wallet in `Layout.tsx` auth gate (passphrase verified via Ed25519 test signature)
2. `auth.ts` stores DID, address, public key, and derived MSP role in memory
3. `api.ts` interceptor injects `X-Msp-Role` from auth (admin/member/observer) and blocks unauthenticated requests
4. `/` (Landing) and `/setup` are standalone routes — no auth required

### Key Concepts

- **Scopes**: organizational units forming a tree, each with its own DLT channel and role-based membership (admin/voter/observer)
- **Permissions**: tree-inherited — founder is root admin everywhere, admin propagates down, voter/observer do not
- **DID**: `did:cerulean:{sha256(pubkey)[0..20]}` — prefix hidden in UI
- **Wallet**: from WASM, Chrome extension (`window.cerulean`), or vault import. Keypair only; names assigned in padron.
- **Vote security**: Ed25519 signature, blind voter ID, per-scope channel isolation

### API Modules

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| Store: Scopes | `POST/GET/GET/{id}/PUT/{id}/DELETE/{id} /store/scopes` | Organizational units CRUD |
| Store: Assemblies | `POST/GET/GET/{id}/PUT/{id}/DELETE/{id} /store/assemblies` | Assembly CRUD (filter: `?scope_id=`) |
| Store: Sessions | `POST/GET/GET/{id}/PUT/{id}/DELETE/{id} /store/sessions` | Session CRUD (filter: `?assembly_id=`) |
| Store: Actas | `POST/GET/GET/{id}/PUT/{id}/DELETE/{id} /store/actas` | Permanent records CRUD |
| Channels | `POST /channels` | Create DLT channels per scope |
| Governance | `/governance/proposals`, `.../vote`, `.../tally` | Elections lifecycle |
| Identity | `/store/identities` | DID registration |
| Vault | `/vault/store`, `/vault/{did}` | Encrypted wallet backup on-chain |
| Health | `/health` | Node availability check |

Headers: `X-Org-Id` (from org channel_id), `X-Msp-Role` (from auth), `X-Channel-Id` (active scope channel or org default).

### Testing

- Vitest + happy-dom, setup in `vite.config.ts`
- `src/test-setup.ts` — localStorage polyfill for Node 22+
- Store tests mock `./api` with `vi.mock()` — test cache behavior, not HTTP
- Auth tests verify role derivation, connect/disconnect, listener notifications

## Conventions

- All UI text is in Spanish
- localStorage keys use `cv_` prefix (only for org settings + active scope)
- Immutable update patterns in store (spread + map, never mutate)
- ISO 8601 dates, correlative folio counters for assemblies and actas
- WASM must be initialized before any crypto operation (`ensureWasm()` guard)
- Auth state is memory-only — never persisted

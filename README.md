# Cerulean Voto

Plataforma multi-tenant de votacion electronica on-chain con firma Ed25519, scopes jerarquicos y actas ancladas en blockchain.

Parte del ecosistema [Cerulean Ledger](https://ceruleanledger.com).

## Stack

- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS 4
- React Router 7
- Axios (HTTP client)
- WASM (cerulean-wallet: Ed25519, Argon2id, AES-256-GCM)
- QRCode.react (codigos QR para wallets)

## Setup

```bash
npm install
npm run dev        # http://localhost:5174
```

Requiere un nodo Cerulean corriendo en `http://127.0.0.1:8080` (proxy automatico via Vite).

Para apuntar a otro nodo:

```bash
VITE_API_PROXY_TARGET=https://api.ceruleanledger.com npm run dev
```

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 5174) |
| `npm run build` | Build de produccion (`tsc -b && vite build`) |
| `npm run preview` | Preview del build local |
| `npm run lint` | ESLint |

## Arquitectura

```
src/
├── pages/           # 12 paginas (lazy-loaded)
├── lib/             # Logica compartida
│   ├── api.ts       # Cliente HTTP: governance, identity, vault, channels
│   ├── store.ts     # Zustand: scopes, assemblies, sessions, actas, permisos
│   ├── wallet.ts    # WASM crypto, vault on-chain, DID derivation, extension
│   ├── routes.ts    # Configuracion de rutas
│   └── format.ts    # Formatters (fechas, hashes)
├── components/
│   └── Layout.tsx   # Header + sidebar agrupado por seccion
└── wasm/            # Bindings de cerulean-wallet (compilados)
```

## Rutas

### Votacion

| Ruta | Pagina | Funcion |
|------|--------|---------|
| `/dashboard` | Panel | Resumen de elecciones activas/cerradas |
| `/elections` | Elecciones | Crear y gestionar propuestas de governance |
| `/vote` | Votar | Emitir voto firmado con Ed25519 |
| `/results` | Resultados | Escrutinio con porcentajes, quorum, threshold |
| `/voters` | Padron | Crear wallets (WASM), importar por DID, QR codes |

### Organizacion

| Ruta | Pagina | Funcion |
|------|--------|---------|
| `/scopes` | Estructura | Arbol de scopes, roles (admin/voter/observer), permisos |
| `/assemblies` | Asambleas | Convocatorias (Ley 19.418 Art. 16), folio correlativo |
| `/sessions` | Sesiones | Citacion, quorum, agenda, acta automatica |
| `/actas` | Actas | Registro permanente (ISO 15489), hash SHA-256, anchor on-chain |

### Administracion

| Ruta | Pagina | Funcion |
|------|--------|---------|
| `/admin` | Admin | Config org, canal DLT, interop (DID/VC/JSON-LD), export |
| `/setup` | Wizard | 5 pasos: wallet, org, participantes, estructura, primera eleccion |

## Seguridad del voto

1. Firma Ed25519 sobre el payload del voto (via WASM o extension Chrome)
2. Blind voter ID: `sha256(proposal_id || voter_did)` — anonimato del votante
3. Verificacion backend + deduplicacion
4. Canal DLT aislado por scope (`X-Channel-Id`)

## Wallet

- Generacion de keypair Ed25519 via WASM (cerulean-wallet)
- DID derivado: `did:cerulean:{sha256(pubkey)[0..20]}`
- Persistencia en vault on-chain — portabilidad cross-app (Voto <-> Wallet)
- Auto-deteccion de extension Chrome (`window.cerulean`)
- Inscripcion de participantes por address o DID existente

## Compliance

- Ley 19.418 Art. 16/17 (asambleas de organizaciones comunitarias)
- ISO 15489 (gestion de registros)
- ISO 8601 (fechas y duraciones)
- W3C DID / Verifiable Credentials / JSON-LD

## Deploy

### Desarrollo con Docker

```bash
docker build -t cerulean-voto .
docker run -p 5174:80 cerulean-voto
```

El contenedor nginx proxea `/api/` hacia `http://node:8080`.

### Produccion (S3 + CloudFront)

```bash
npm run build
aws s3 sync dist/ s3://ceruleanledger-voto/ --delete
aws cloudfront create-invalidation --distribution-id E2QW638B59JZ89 --paths "/*"
```

URL: https://voto.ceruleanledger.com

## Variables de entorno (Vite)

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8080` | Backend API para proxy en dev |
| `VITE_DEV_SERVER_PORT` | `5174` | Puerto del dev server |

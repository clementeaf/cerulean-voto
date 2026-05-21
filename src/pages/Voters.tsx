import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  CERULEAN_WALLET_URL,
  getStoredWallets,
  deleteStoredWallet,
  importFromVault,
  didFromWallet,
  storeWallet,
  type StoredWallet,
  type WalletFile,
} from '../lib/wallet'
import { resolveAlias, validateAlias, getCachedAlias } from '../lib/alias'

export default function Voters() {
  const [wallets, setWallets] = useState<StoredWallet[]>(getStoredWallets)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [inscribeAddress, setInscribeAddress] = useState('')
  const [inscribeName, setInscribeName] = useState('')
  const [importDid, setImportDid] = useState('')
  const [aliasInput, setAliasInput] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  function reload() { setWallets(getStoredWallets()) }

  async function handleImport() {
    setMsg(''); setErr('')
    if (!importDid.trim()) { setErr('Ingresa el DID de la wallet'); return }
    setLoading(true)
    try {
      const result = await importFromVault(importDid.trim())
      if (result) {
        setMsg(`Wallet importada: ${result.name || importDid.trim().slice(0, 20) + '...'}`)
        setImportDid('')
        reload()
      } else {
        setErr('Wallet no encontrada en la red. Verifica el DID.')
      }
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  async function handleAliasResolve() {
    setMsg(''); setErr('')
    const raw = aliasInput.trim()
    const validationErr = validateAlias(raw)
    if (validationErr) { setErr(validationErr); return }
    setLoading(true)
    try {
      const result = await resolveAlias(raw)
      if (result) {
        const placeholderWallet: WalletFile = {
          version: 1, algorithm: 'ed25519', address: result.address, public_key: '',
          private_key: { type: 'Encrypted', ciphertext: '', salt: '', nonce: '' },
        }
        storeWallet(raw, placeholderWallet)
        setMsg(`"${raw}" resuelto → ${result.did.slice(0, 30)}... inscrito en el padron`)
        setAliasInput('')
        reload()
      } else {
        setErr(`Alias "${raw}" no encontrado en la red`)
      }
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al resolver alias')
    } finally {
      setLoading(false)
    }
  }

  function handleInscribe() {
    setMsg(''); setErr('')
    const input = inscribeAddress.trim()
    if (!input) { setErr('Ingresa una direccion o DID'); return }

    const isDid = input.startsWith('did:cerulean:')
    const address = isDid ? input.replace('did:cerulean:', '') : input
    const label = inscribeName.trim()

    const placeholderWallet: WalletFile = {
      version: 1, algorithm: 'ed25519', address, public_key: '',
      private_key: { type: 'Encrypted', ciphertext: '', salt: '', nonce: '' },
    }
    storeWallet(label, placeholderWallet)
    setMsg(`${label || address.slice(0, 12) + '...'} inscrito en el padron`)
    setInscribeAddress(''); setInscribeName('')
    reload()
  }

  function handleDownload(w: StoredWallet) {
    const blob = new Blob([JSON.stringify(w.walletFile, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cerulean-wallet-${w.name.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleDelete(address: string) {
    deleteStoredWallet(address)
    setConfirmDelete(null)
    setExpanded(null)
    reload()
  }

  return (
    <div className="h-full flex flex-col min-h-0 gap-3">
      {/* Invite by alias */}
      <div className="bg-white rounded-lg border border-neutral-100 px-4 py-3 shrink-0">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Invitar por alias</p>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Alias del participante</label>
            <input
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
              value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
              placeholder="pedro_gonzalez"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAliasResolve() }}
            />
          </div>
          <button onClick={handleAliasResolve} disabled={loading}
            className={`${loading ? 'bg-neutral-300' : 'bg-main-500 hover:bg-main-600'} text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors shrink-0`}>
            {loading ? 'Buscando...' : 'Resolver e inscribir'}
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 mt-1.5">
          Ingresa el alias del participante para resolver su identidad en la red e inscribirlo en el padron.
        </p>
      </div>

      {/* Inscribe by address */}
      <div className="bg-white rounded-lg border border-neutral-100 px-4 py-3 shrink-0">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Inscribir participante por direccion</p>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Direccion o DID de la wallet</label>
            <input
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm font-mono"
              value={inscribeAddress} onChange={(e) => setInscribeAddress(e.target.value)}
              placeholder="Direccion hex de la wallet"
            />
          </div>
          <div className="w-40 shrink-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Nombre (opcional)</label>
            <input
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
              value={inscribeName} onChange={(e) => setInscribeName(e.target.value)}
              placeholder="Juan Perez"
            />
          </div>
          <button
            onClick={handleInscribe}
            className="bg-main-500 hover:bg-main-600 text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors shrink-0"
          >
            Inscribir
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-neutral-400">
            Cada persona crea su wallet en Cerulean Wallet. Inscribe su direccion para habilitarlo en el padron.
          </p>
          <a href={CERULEAN_WALLET_URL} target="_blank" rel="noreferrer"
            className="text-[10px] text-main-600 hover:underline shrink-0 ml-2">
            Crear wallet en Cerulean Wallet
          </a>
        </div>
        {msg && <p className="mt-2 text-xs text-green-700 bg-green-50 rounded p-2">{msg}</p>}
        {err && <p className="mt-2 text-xs text-red-700 bg-red-50 rounded p-2">{err}</p>}
      </div>

      {/* Import from vault */}
      <div className="bg-white rounded-lg border border-neutral-100 px-4 py-3 shrink-0">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Importar wallet existente</p>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Direccion de la wallet</label>
            <input
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm font-mono"
              value={importDid} onChange={(e) => setImportDid(e.target.value)}
              placeholder="Direccion hex de la wallet"
            />
          </div>
          <button onClick={handleImport} disabled={loading}
            className={`${loading ? 'bg-neutral-300' : 'bg-neutral-800 hover:bg-neutral-900'} text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors shrink-0`}>
            {loading ? 'Buscando...' : 'Importar desde red'}
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 mt-1.5">
          Si ya tienes wallet en Cerulean Wallet u otra app, ingresa tu DID para importarla desde la blockchain.
        </p>
      </div>

      {/* Voter table */}
      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2 border-b border-neutral-100 shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">Padron electoral ({wallets.length})</span>
          <span className="text-[10px] text-neutral-400">Ed25519 + Argon2id + AES-256-GCM</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {wallets.length === 0 ? (
            <p className="text-sm text-neutral-300 p-4">Sin votantes registrados. Inscribe participantes por su direccion de wallet o importa desde la red.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {wallets.map((w) => {
                const did = didFromWallet(w.walletFile)
                const isExpanded = expanded === w.walletFile.address
                const alias = getCachedAlias(did)
                return (
                  <div key={w.walletFile.address} className="px-3 py-2.5">
                    {/* Row */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <button onClick={() => setExpanded(isExpanded ? null : w.walletFile.address)} className="text-sm font-medium text-neutral-800 hover:text-main-600 text-left">
                          {w.name}
                        </button>
                        <div className="flex items-center gap-2">
                          {alias && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium">@{alias}</span>
                          )}
                          <p className="text-[10px] font-mono text-neutral-400 truncate">{did}</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium shrink-0">
                        {w.walletFile.algorithm.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium shrink-0">
                        Habilitado
                      </span>
                      <button onClick={() => handleDownload(w)} className="text-[10px] text-main-600 hover:underline shrink-0">
                        Descargar
                      </button>
                      {confirmDelete === w.walletFile.address ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleDelete(w.walletFile.address)} className="text-xs text-red-600 font-semibold">Si</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-neutral-400">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(w.walletFile.address)} className="text-[10px] text-neutral-400 hover:text-red-500 shrink-0">
                          Eliminar
                        </button>
                      )}
                    </div>

                    {/* Expanded details + QR */}
                    {isExpanded && (
                      <div className="mt-2 bg-neutral-50 rounded-lg p-3 text-xs">
                        <div className="flex gap-4">
                          {/* QR */}
                          <div className="shrink-0 flex flex-col items-center">
                            <div className="bg-white border border-neutral-200 rounded-xl p-3">
                              <QRCodeSVG
                                value={JSON.stringify({
                                  type: 'cerulean-wallet-link',
                                  did,
                                  address: w.walletFile.address,
                                  public_key: w.walletFile.public_key,
                                  algorithm: w.walletFile.algorithm,
                                })}
                                size={120}
                                level="M"
                                bgColor="#ffffff"
                                fgColor="#171717"
                              />
                            </div>
                            <p className="text-[9px] text-neutral-400 mt-1.5 text-center">Escanear para vincular wallet</p>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <p className="text-[10px] text-neutral-400 uppercase">DID (W3C)</p>
                              <p className="font-mono text-neutral-600 break-all select-all">{did}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-neutral-400 uppercase">Address</p>
                              <p className="font-mono text-neutral-600 break-all select-all">{w.walletFile.address}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-neutral-400 uppercase">Public Key</p>
                              <p className="font-mono text-neutral-600 break-all select-all">{w.walletFile.public_key}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <p className="text-[10px] text-neutral-400 uppercase">Algoritmo</p>
                                <p className="text-neutral-600">{w.walletFile.algorithm === 'ed25519' ? 'Ed25519' : w.walletFile.algorithm}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-neutral-400 uppercase">Cifrado</p>
                                <p className="text-neutral-600">Argon2id + AES-256-GCM</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-neutral-400 uppercase">Registrado</p>
                                <p className="text-neutral-600">{new Date(w.created_at).toLocaleString('es-CL')}</p>
                              </div>
                            </div>
                            <div className="flex gap-3 pt-1">
                              <a href={`/api/v1/did/${encodeURIComponent(did)}`} target="_blank" rel="noreferrer"
                                className="text-[10px] text-main-600 hover:underline">
                                DID Document (W3C)
                              </a>
                              <button
                                onClick={() => { navigator.clipboard.writeText(did) }}
                                className="text-[10px] text-main-600 hover:underline"
                              >
                                Copiar DID
                              </button>
                              <button
                                onClick={() => { navigator.clipboard.writeText(w.walletFile.address) }}
                                className="text-[10px] text-main-600 hover:underline"
                              >
                                Copiar Address
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

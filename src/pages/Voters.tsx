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

type InscribeMode = 'alias' | 'address'

export default function Voters() {
  const [wallets, setWallets] = useState<StoredWallet[]>(getStoredWallets)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [mode, setMode] = useState<InscribeMode>('alias')
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  function reload() { setWallets(getStoredWallets()) }

  async function handleSubmit() {
    setMsg(''); setErr('')
    const value = input.trim()
    if (!value) { setErr('Ingresa un valor'); return }

    setLoading(true)
    try {
      if (mode === 'alias') {
        const validationErr = validateAlias(value)
        if (validationErr) { setErr(validationErr); return }
        const result = await resolveAlias(value)
        if (!result) { setErr(`Alias "${value}" no encontrado en la red`); return }
        const placeholderWallet: WalletFile = {
          version: 1, algorithm: 'ed25519', address: result.address, public_key: '',
          private_key: { type: 'Encrypted', ciphertext: '', salt: '', nonce: '' },
        }
        storeWallet(value, placeholderWallet)
        setMsg(`@${value} inscrito en el padron`)
      } else {
        // Address or DID
        const isDid = value.startsWith('did:cerulean:')
        const address = isDid ? value.replace('did:cerulean:', '') : value
        // Try importing from vault first
        const vaultResult = await importFromVault(isDid ? value : `did:cerulean:${value}`)
        if (vaultResult) {
          setMsg(`${vaultResult.name || address.slice(0, 12) + '...'} importado e inscrito`)
        } else {
          const placeholderWallet: WalletFile = {
            version: 1, algorithm: 'ed25519', address, public_key: '',
            private_key: { type: 'Encrypted', ciphertext: '', salt: '', nonce: '' },
          }
          storeWallet(address.slice(0, 12), placeholderWallet)
          setMsg(`${address.slice(0, 12)}... inscrito en el padron`)
        }
      }
      setInput('')
      reload()
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error')
    } finally {
      setLoading(false)
    }
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

  const modeClass = (m: InscribeMode) =>
    `flex-1 py-1.5 text-xs font-semibold transition-colors rounded ${mode === m ? 'bg-main-500 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`

  return (
    <div className="h-full flex flex-col min-h-0 gap-3">
      {/* Inscribe */}
      <div className="bg-white rounded-lg border border-neutral-100 px-4 py-3 shrink-0">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Inscribir participante</p>
        <div className="flex gap-1 bg-neutral-50 rounded p-0.5 mb-3">
          <button onClick={() => { setMode('alias'); setInput(''); setErr(''); setMsg('') }} className={modeClass('alias')}>Por alias</button>
          <button onClick={() => { setMode('address'); setInput(''); setErr(''); setMsg('') }} className={modeClass('address')}>Por direccion</button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <input
              className={`w-full rounded border border-neutral-200 px-2 py-1.5 text-sm ${mode === 'address' ? 'font-mono' : ''}`}
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'alias' ? 'pedro_gonzalez' : 'Direccion hex o DID'}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className={`${loading ? 'bg-neutral-300' : 'bg-main-500 hover:bg-main-600'} text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors shrink-0`}>
            {loading ? 'Buscando...' : 'Inscribir'}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-neutral-400">
            {mode === 'alias'
              ? 'Resuelve el alias en la red e inscribe al participante.'
              : 'Ingresa la direccion hex o DID. Si existe en la red, importa sus datos.'}
          </p>
          <a href={CERULEAN_WALLET_URL} target="_blank" rel="noreferrer"
            className="text-[10px] text-main-600 hover:underline shrink-0 ml-2">
            Crear wallet
          </a>
        </div>
        {msg && <p className="mt-2 text-xs text-green-700 bg-green-50 rounded p-2">{msg}</p>}
        {err && <p className="mt-2 text-xs text-red-700 bg-red-50 rounded p-2">{err}</p>}
      </div>

      {/* Voter table */}
      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2 border-b border-neutral-100 shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">Padron electoral ({wallets.length})</span>
          <span className="text-[10px] text-neutral-400">Ed25519 + Argon2id + AES-256-GCM</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {wallets.length === 0 ? (
            <p className="text-sm text-neutral-300 p-4">Sin votantes registrados.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {wallets.map((w) => {
                const did = didFromWallet(w.walletFile)
                const isExpanded = expanded === w.walletFile.address
                const alias = getCachedAlias(did)
                return (
                  <div key={w.walletFile.address} className="px-3 py-2.5">
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium shrink-0">
                        Habilitado
                      </span>
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

                    {isExpanded && (
                      <div className="mt-2 bg-neutral-50 rounded-lg p-3 text-xs">
                        <div className="flex gap-4">
                          <div className="shrink-0 flex flex-col items-center">
                            <div className="bg-white border border-neutral-200 rounded-xl p-3">
                              <QRCodeSVG
                                value={JSON.stringify({ type: 'cerulean-wallet-link', did, address: w.walletFile.address, public_key: w.walletFile.public_key, algorithm: w.walletFile.algorithm })}
                                size={120} level="M" bgColor="#ffffff" fgColor="#171717"
                              />
                            </div>
                            <p className="text-[9px] text-neutral-400 mt-1.5 text-center">Escanear para vincular</p>
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <p className="text-[10px] text-neutral-400 uppercase">DID</p>
                              <p className="font-mono text-neutral-600 break-all select-all">{did}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-neutral-400 uppercase">Address</p>
                              <p className="font-mono text-neutral-600 break-all select-all">{w.walletFile.address}</p>
                            </div>
                            {w.walletFile.public_key && (
                              <div>
                                <p className="text-[10px] text-neutral-400 uppercase">Public Key</p>
                                <p className="font-mono text-neutral-600 break-all select-all">{w.walletFile.public_key}</p>
                              </div>
                            )}
                            <div className="flex gap-3 pt-1">
                              <button onClick={() => handleDownload(w)} className="text-[10px] text-main-600 hover:underline">Descargar</button>
                              <button onClick={() => navigator.clipboard.writeText(did)} className="text-[10px] text-main-600 hover:underline">Copiar DID</button>
                              <button onClick={() => navigator.clipboard.writeText(w.walletFile.address)} className="text-[10px] text-main-600 hover:underline">Copiar Address</button>
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

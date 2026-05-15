import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { registerIdentity } from '../lib/api'
import {
  createWallet,
  storeWallet,
  getStoredWallets,
  deleteStoredWallet,
  didFromWallet,
  type StoredWallet,
} from '../lib/wallet'

export default function Voters() {
  const [wallets, setWallets] = useState<StoredWallet[]>(getStoredWallets)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  function reload() { setWallets(getStoredWallets()) }

  async function handleRegister() {
    setMsg(''); setErr('')
    if (!name.trim()) { setErr('El nombre es obligatorio'); return }
    if (passphrase.length < 4) { setErr('La clave debe tener al menos 4 caracteres'); return }

    setLoading(true)
    try {
      const walletFile = await createWallet(passphrase)
      const did = didFromWallet(walletFile)
      await registerIdentity({
        did,
        public_key: walletFile.public_key,
        metadata: { voter_name: name.trim(), address: walletFile.address },
      })
      storeWallet(name.trim(), walletFile)
      setMsg(`${name.trim()} registrado — wallet Ed25519 generada`)
      setName(''); setPassphrase('')
      reload()
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al registrar')
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

  return (
    <div className="h-full flex flex-col min-h-0 gap-3">
      {/* Register */}
      <div className="bg-white rounded-lg border border-neutral-100 px-4 py-3 shrink-0">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Registrar votante</p>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Nombre completo</label>
            <input
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Juan Perez"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Clave de cifrado</label>
            <input
              type="password"
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
              value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Minimo 4 caracteres"
            />
          </div>
          <button
            onClick={handleRegister} disabled={loading}
            className={`${loading ? 'bg-neutral-300' : 'bg-main-500 hover:bg-main-600'} text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors shrink-0`}
          >
            {loading ? 'Generando...' : 'Registrar'}
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 mt-2">
          Genera un keypair Ed25519 real. La clave privada se cifra con Argon2id + AES-256-GCM. La clave de cifrado no se almacena — se necesita para firmar votos.
        </p>
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
            <p className="text-sm text-neutral-300 p-4">Sin votantes registrados. Usa el formulario de arriba para generar una wallet y registrar un votante.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {wallets.map((w) => {
                const did = didFromWallet(w.walletFile)
                const isExpanded = expanded === w.walletFile.address
                return (
                  <div key={w.walletFile.address} className="px-3 py-2.5">
                    {/* Row */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <button onClick={() => setExpanded(isExpanded ? null : w.walletFile.address)} className="text-sm font-medium text-neutral-800 hover:text-main-600 text-left">
                          {w.name}
                        </button>
                        <p className="text-[10px] font-mono text-neutral-400 truncate">{did}</p>
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

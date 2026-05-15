import { useState } from 'react'
import { registerIdentity } from '../lib/api'
import {
  createWallet,
  storeWallet,
  getStoredWallets,
  deleteStoredWallet,
  didFromWallet,
  type StoredWallet,
} from '../lib/wallet'
import { shortHash } from '../lib/format'

export default function Voters() {
  const [wallets, setWallets] = useState<StoredWallet[]>(getStoredWallets)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  function reload() {
    setWallets(getStoredWallets())
  }

  async function handleRegister() {
    setMsg('')
    setErr('')
    if (!name.trim()) { setErr('El nombre es obligatorio'); return }
    if (passphrase.length < 4) { setErr('La clave debe tener al menos 4 caracteres'); return }

    setLoading(true)
    try {
      // Generate real Ed25519 wallet via WASM
      const walletFile = await createWallet(passphrase)
      const did = didFromWallet(walletFile)

      // Register DID on blockchain with public key
      await registerIdentity({
        did,
        public_key: walletFile.public_key,
        metadata: { voter_name: name.trim(), address: walletFile.address },
      })

      // Store wallet locally
      storeWallet(name.trim(), walletFile)
      setMsg(`${name.trim()} registrado con wallet Ed25519`)
      setName('')
      setPassphrase('')
      reload()
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  function handleDelete(address: string) {
    deleteStoredWallet(address)
    setConfirmDelete(null)
    reload()
  }

  return (
    <div className="h-full flex flex-col min-h-0 gap-3">
      {/* Register */}
      <div className="bg-white rounded-lg border border-neutral-100 px-3 py-2.5 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Nombre</label>
            <input
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Perez"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-neutral-400 mb-0.5">Clave de wallet</label>
            <input
              type="password"
              className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Clave para cifrar la wallet"
            />
          </div>
          <button
            onClick={handleRegister}
            disabled={loading}
            className={`${loading ? 'bg-neutral-300' : 'bg-main-500 hover:bg-main-600'} text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors shrink-0`}
          >
            {loading ? 'Generando...' : 'Registrar'}
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 mt-1.5">
          Genera un wallet Ed25519 real (Argon2id + AES-256-GCM). La clave cifra la llave privada — no se almacena.
        </p>
        {msg && <p className="mt-1.5 text-xs text-green-700">{msg}</p>}
        {err && <p className="mt-1.5 text-xs text-red-700">{err}</p>}
      </div>

      {/* Voter table */}
      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-1.5 border-b border-neutral-100 shrink-0 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-500">Padron ({wallets.length})</span>
          <span className="text-[10px] text-neutral-400">Ed25519 + Argon2id</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {wallets.length === 0 ? (
            <p className="text-sm text-neutral-300 p-3">Sin votantes registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-neutral-100 text-left text-neutral-400 text-xs">
                  <th className="py-1.5 px-3">Nombre</th>
                  <th className="py-1.5 px-3">DID</th>
                  <th className="py-1.5 px-3">Address</th>
                  <th className="py-1.5 px-3">Algoritmo</th>
                  <th className="py-1.5 px-3">Estado</th>
                  <th className="py-1.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.walletFile.address} className="border-b border-neutral-50 last:border-0">
                    <td className="py-1.5 px-3 text-sm font-medium">{w.name}</td>
                    <td className="py-1.5 px-3 font-mono text-xs text-neutral-400">{shortHash(didFromWallet(w.walletFile))}</td>
                    <td className="py-1.5 px-3 font-mono text-xs text-neutral-400">{shortHash(w.walletFile.address)}</td>
                    <td className="py-1.5 px-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {w.walletFile.algorithm}
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                        Registrado
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      {confirmDelete === w.walletFile.address ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(w.walletFile.address)} className="text-xs text-red-600 font-semibold">Si</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-neutral-400">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(w.walletFile.address)} className="text-xs text-neutral-400 hover:text-red-500">
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

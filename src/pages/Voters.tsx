import { useState } from 'react'
import { registerIdentity, getIdentity } from '../lib/api'
import { getVoters, saveVoter, deleteVoter, type Voter } from '../lib/store'
import { shortHash } from '../lib/format'

export default function Voters() {
  const [voters, setVoters] = useState<Voter[]>(getVoters)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [rut, setRut] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const [lookupDid, setLookupDid] = useState('')
  const [lookupResult, setLookupResult] = useState<string>('')

  function reload() {
    setVoters(getVoters())
  }

  async function handleRegister() {
    setMsg('')
    setErr('')
    if (!name.trim()) { setErr('El nombre es obligatorio'); return }
    const did = `did:cerulean:${name.trim().toLowerCase().replace(/\s+/g, '-')}`
    try {
      // Register on blockchain
      await registerIdentity({
        did,
        public_key: 'auto-' + Date.now(),
        metadata: rut ? { voter_name: name.trim(), rut } : { voter_name: name.trim() },
      })
      // Persist locally
      saveVoter({ did, name: name.trim(), rut: rut.trim() })
      setMsg(`${name.trim()} registrado`)
      setName('')
      setRut('')
      reload()
    } catch (e: unknown) {
      setErr((e as Error)?.message || 'Error al registrar')
    }
  }

  function handleDelete(did: string) {
    deleteVoter(did)
    setConfirmDelete(null)
    reload()
  }

  async function handleLookup() {
    setLookupResult('')
    if (!lookupDid.trim()) return
    try {
      const result = await getIdentity(lookupDid)
      setLookupResult(JSON.stringify(result, null, 2))
    } catch {
      setLookupResult('No encontrado.')
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0 gap-3">
      {/* Top row — register inline + verify */}
      <div className="flex flex-col lg:flex-row gap-3 shrink-0">
        {/* Register */}
        <div className="flex-1 bg-white rounded-lg border border-neutral-100 px-3 py-2.5">
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
            <div className="w-32 shrink-0">
              <label className="block text-[10px] text-neutral-400 mb-0.5">RUT (opc.)</label>
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12.345.678-9"
              />
            </div>
            <button
              onClick={handleRegister}
              className="bg-main-500 text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-main-600 transition-colors shrink-0"
            >
              Registrar
            </button>
          </div>
          {msg && <p className="mt-1.5 text-xs text-green-700">{msg}</p>}
          {err && <p className="mt-1.5 text-xs text-red-700">{err}</p>}
        </div>

        {/* Verify */}
        <div className="bg-white rounded-lg border border-neutral-100 px-3 py-2.5 lg:w-80 shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] text-neutral-400 mb-0.5">Verificar registro</label>
              <input
                className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
                value={lookupDid}
                onChange={(e) => setLookupDid(e.target.value)}
                placeholder="Identificador"
              />
            </div>
            <button
              onClick={handleLookup}
              className="bg-neutral-700 text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-neutral-800 transition-colors shrink-0"
            >
              Buscar
            </button>
          </div>
          {lookupResult && (
            <pre className="mt-1.5 bg-neutral-50 rounded p-2 text-[11px] font-mono overflow-x-auto max-h-20 overflow-y-auto">
              {lookupResult}
            </pre>
          )}
        </div>
      </div>

      {/* Voter table — fills remaining space */}
      <section className="bg-white rounded-lg border border-neutral-100 flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-1.5 border-b border-neutral-100 shrink-0 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-500">Padron ({voters.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {voters.length === 0 ? (
            <p className="text-sm text-neutral-300 p-3">Sin votantes registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-neutral-100 text-left text-neutral-400 text-xs">
                  <th className="py-1.5 px-3">Nombre</th>
                  <th className="py-1.5 px-3">RUT</th>
                  <th className="py-1.5 px-3">ID</th>
                  <th className="py-1.5 px-3">Estado</th>
                  <th className="py-1.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {voters.map((v) => (
                  <tr key={v.did} className="border-b border-neutral-50 last:border-0">
                    <td className="py-1.5 px-3 text-sm">{v.name}</td>
                    <td className="py-1.5 px-3 text-sm text-neutral-500">{v.rut || '--'}</td>
                    <td className="py-1.5 px-3 font-mono text-xs text-neutral-400">{shortHash(v.did)}</td>
                    <td className="py-1.5 px-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                        Registrado
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      {confirmDelete === v.did ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(v.did)} className="text-xs text-red-600 font-semibold">Si</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-neutral-400">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(v.did)} className="text-xs text-neutral-400 hover:text-red-500">
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

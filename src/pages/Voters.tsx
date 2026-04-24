import { useState } from 'react'
import PageIntro from '../components/PageIntro'
import { registerIdentity, getIdentity } from '../lib/api'
import { shortHash } from '../lib/format'

interface VoterEntry {
  did: string
  name: string
  registered: boolean
}

export default function Voters() {
  const [voters, setVoters] = useState<VoterEntry[]>([])

  // Registration form
  const [did, setDid] = useState('did:cerulean:')
  const [name, setName] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Lookup
  const [lookupDid, setLookupDid] = useState('')
  const [lookupResult, setLookupResult] = useState<string>('')

  async function handleRegister() {
    setMsg('')
    setErr('')
    if (!did || did === 'did:cerulean:' || !name.trim()) {
      setErr('DID y nombre son obligatorios')
      return
    }
    try {
      await registerIdentity({
        did,
        public_key: publicKey || 'placeholder-key-' + Date.now(),
        metadata: { voter_name: name },
      })
      setVoters((prev) => [...prev, { did, name, registered: true }])
      setMsg(`Votante ${name} registrado correctamente`)
      setDid('did:cerulean:')
      setName('')
      setPublicKey('')
    } catch (e: unknown) {
      const error = e as Error
      setErr(error?.message || 'Error al registrar votante')
    }
  }

  async function handleLookup() {
    setLookupResult('')
    if (!lookupDid.trim()) return
    try {
      const result = await getIdentity(lookupDid)
      setLookupResult(JSON.stringify(result, null, 2))
    } catch {
      setLookupResult('Votante no encontrado en el padron.')
    }
  }

  return (
    <div className="space-y-8">
      <PageIntro title="Padron Electoral">
        Registro de votantes habilitados mediante identidades descentralizadas (DIDs).
        Cada votante recibe una credencial verificable que lo habilita para participar.
      </PageIntro>

      {/* Register voter */}
      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Registrar Votante</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">DID</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm font-mono"
              value={did}
              onChange={(e) => setDid(e.target.value)}
              placeholder="did:cerulean:voter001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Perez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Clave publica (opcional)</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm font-mono"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="hex..."
            />
          </div>
        </div>

        <button
          onClick={handleRegister}
          className="bg-main-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-main-600 transition-colors"
        >
          Registrar
        </button>

        {msg && <p className="mt-3 text-sm text-green-700 bg-green-50 rounded p-2">{msg}</p>}
        {err && <p className="mt-3 text-sm text-red-700 bg-red-50 rounded p-2">{err}</p>}
      </section>

      {/* Voter list (session) */}
      {voters.length > 0 && (
        <section className="bg-white rounded-lg border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Votantes Registrados (esta sesion)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 pr-3">DID</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {voters.map((v) => (
                  <tr key={v.did} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{shortHash(v.did)}</td>
                    <td className="py-2 pr-3">{v.name}</td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
                        Registrado
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Lookup voter */}
      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Consultar Votante</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700 mb-1">DID a consultar</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm font-mono"
              value={lookupDid}
              onChange={(e) => setLookupDid(e.target.value)}
              placeholder="did:cerulean:voter001"
            />
          </div>
          <button
            onClick={handleLookup}
            className="bg-neutral-800 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-neutral-900 transition-colors"
          >
            Buscar
          </button>
        </div>

        {lookupResult && (
          <pre className="mt-4 bg-neutral-50 rounded-lg p-4 text-xs font-mono overflow-x-auto border">
            {lookupResult}
          </pre>
        )}
      </section>
    </div>
  )
}

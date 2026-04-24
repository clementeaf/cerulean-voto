import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const nav = useNavigate()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-main-50 text-main-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Verificable, inmutable, post-cuantico
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-neutral-900 tracking-tight leading-tight mb-6">
            Voto electronico<br />
            <span className="text-main-500">sobre blockchain</span>
          </h1>

          <p className="text-lg text-neutral-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Cada voto queda registrado en una cadena inmutable con consenso BFT y firmas
            post-cuanticas. Cualquier persona puede auditar el resultado sin comprometer
            la privacidad de los votantes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => nav('/dashboard')}
              className="bg-main-500 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-main-600 transition-colors shadow-lg shadow-main-500/20"
            >
              Ingresar al sistema
            </button>
            <button
              onClick={() => nav('/results')}
              className="bg-white text-neutral-700 px-8 py-3 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-colors border border-neutral-200"
            >
              Ver resultados publicos
            </button>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="bg-white border-t border-neutral-200 py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              title: 'Inmutable',
              desc: 'Consenso BFT garantiza que ningun voto pueda ser alterado, eliminado o duplicado despues de ser registrado.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              ),
            },
            {
              title: 'Verificable',
              desc: 'Cualquier observador puede auditar el escrutinio completo sin acceder a votos individuales.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ),
            },
            {
              title: 'Post-cuantico',
              desc: 'Firmas ML-DSA-65 (FIPS 204) protegen cada voto contra ataques de computacion cuantica futura.',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              ),
            },
          ].map((p) => (
            <div key={p.title} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-main-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-main-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {p.icon}
                </svg>
              </div>
              <h3 className="font-bold text-neutral-900 mb-2">{p.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-neutral-400">
          <span>Cerulean Voto</span>
          <span>Powered by Cerulean Ledger</span>
        </div>
      </footer>
    </div>
  )
}

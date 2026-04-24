/** Tiempo relativo en espanol desde un timestamp Unix (segundos). */
export function timeAgo(ts: number): string {
  if (!ts) return '--'
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 0) return 'reciente'
  if (diff < 60) return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

/** Acorta un hash o DID largo. */
export function shortHash(h: string): string {
  return h.length > 16 ? h.slice(0, 8) + '...' + h.slice(-8) : h
}

/** Fecha legible en espanol desde timestamp Unix (segundos). */
export function fmtDate(ts: number): string {
  if (!ts) return '--'
  return new Date(ts * 1000).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Fecha + hora legible. */
export function fmtDateTime(ts: number): string {
  if (!ts) return '--'
  return new Date(ts * 1000).toLocaleString('es-CL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Tiempo restante hasta un timestamp futuro. */
export function timeRemaining(ts: number): string {
  if (!ts) return '--'
  const diff = ts - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'finalizada'
  if (diff < 3600) return `${Math.ceil(diff / 60)} min restantes`
  if (diff < 86400) return `${Math.ceil(diff / 3600)} h restantes`
  return `${Math.ceil(diff / 86400)} d restantes`
}

/** Porcentaje con 1 decimal. */
export function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

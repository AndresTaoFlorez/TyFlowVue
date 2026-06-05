/**
 * Date formatting helpers shared across calendar/work-window components.
 */

/** Date object → "YYYY-MM-DD" */
export function fmtDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Today as "YYYY-MM-DD" */
export function todayISO() {
  return fmtDateISO(new Date())
}

/** Timestamp string → "YYYY-MM-DD" */
export function dateFromTimestamp(ts) {
  if (!ts) return ''
  return fmtDateISO(new Date(ts))
}

/** ISO timestamp → es-CO date+time (e.g. "03 jun 2026, 10:30") */
export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** ISO date string → es-CO locale display (e.g. "lun, 3 jun 2026") */
export function fmtDateLocale(date, options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!date) return '—'
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('es-CO', options)
}

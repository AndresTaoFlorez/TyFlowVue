/**
 * Time formatting helpers shared across calendar/work-window components.
 */

/** Pad hour + minute numbers → "HH:MM" */
export function fmtHM(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Half-hour slot index (0–47) → "HH:MM" */
export function fmtSlotTime(slot) {
  return fmtHM(Math.floor(slot / 2), (slot % 2) * 30)
}

/** Total minutes → "HH:MM" */
export function fmtTimeFromMins(totalMins) {
  return fmtHM(Math.floor(totalMins / 60), totalMins % 60)
}

/** Normalize a "H:M" or "HH:MM" string for <input type="time"> */
export function fmtForInput(time) {
  if (!time) return '08:00'
  const parts = time.split(':')
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

/** "HH:MM" → "h:MM AM/PM" */
export function fmtTime12h(time) {
  if (!time) return '?'
  const parts = time.split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1]
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${suffix}`
}

/** "HH:MM" → "AM" or "PM" */
export function ampm(time) {
  if (!time) return ''
  const h = parseInt(time.split(':')[0])
  return h < 12 ? 'AM' : 'PM'
}

/** Hour number (0–23) → "12 AM", "1 PM", etc. */
export function formatHour(h) {
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display} ${suffix}`
}

/** Hour number → compact "12a", "1p" (returns '' for non-integer) */
export function formatHourCompact(h) {
  const hour = Math.floor(h)
  if (!Number.isInteger(h)) return ''
  if (hour === 0) return '12a'
  if (hour === 12) return '12p'
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

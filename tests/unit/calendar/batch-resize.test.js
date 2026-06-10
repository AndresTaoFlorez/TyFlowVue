/**
 * Bug 1 — Batch resize/reschedule must preserve each window's individual date.
 *
 * Verifies that applying a delta to two windows with the same time-of-day but
 * different dates does NOT flatten them to the same date.
 */
import { describe, it, expect } from 'vitest'
import { WorkWindow } from '@/domain/entities/WorkWindow.js'

// Helper: reproduce the absolute-instant delta math used by the fixed batchResize
function applyDeltaMs(orig, direction, deltaMs) {
  const raw = orig._toRaw()
  if (direction === 'top') {
    const newStart = new Date(new Date(orig.startsAt).getTime() + deltaMs)
    raw.starts_at = dateToTimestampTz(newStart)
  } else {
    const newEnd = new Date(new Date(orig.endsAt).getTime() + deltaMs)
    raw.ends_at = dateToTimestampTz(newEnd)
  }
  return new WorkWindow(raw)
}

function dateToTimestampTz(d) {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const oh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const om = String(Math.abs(offset) % 60).padStart(2, '0')
  return `${y}-${mo}-${dd}T${hh}:${mm}:${ss}${sign}${oh}:${om}`
}

describe('Bug 1 — batch resize preserves per-window dates', () => {
  // Two windows at 09:00–17:00 on DIFFERENT dates
  const wMonday = new WorkWindow({
    id: 'w-monday',
    specialist_id: 'spec-1',
    application_id: 'app-1',
    starts_at: '2026-06-08T09:00:00-05:00', // Monday
    ends_at: '2026-06-08T17:00:00-05:00',
  })

  const wTuesday = new WorkWindow({
    id: 'w-tuesday',
    specialist_id: 'spec-1',
    application_id: 'app-1',
    starts_at: '2026-06-09T09:00:00-05:00', // Tuesday
    ends_at: '2026-06-09T17:00:00-05:00',
  })

  it('bottom-resize: each window keeps its own date after delta', () => {
    const deltaSlots = 2 // +1 hour
    const deltaMs = deltaSlots * 30 * 60 * 1000

    const resizedMon = applyDeltaMs(wMonday, 'bottom', deltaMs)
    const resizedTue = applyDeltaMs(wTuesday, 'bottom', deltaMs)

    // End time should be 18:00 for both
    expect(resizedMon.endTime).toBe('18:00')
    expect(resizedTue.endTime).toBe('18:00')

    // Crucially: dates must NOT converge — each keeps its own date
    expect(resizedMon.scheduledDate).toBe('2026-06-08') // Monday
    expect(resizedTue.scheduledDate).toBe('2026-06-09') // Tuesday
    expect(resizedMon.endDate).toBe('2026-06-08')
    expect(resizedTue.endDate).toBe('2026-06-09')

    // The raw starts_at/ends_at must differ
    expect(resizedMon.endsAt).not.toBe(resizedTue.endsAt)
  })

  it('top-resize: each window keeps its own date after delta', () => {
    const deltaSlots = -2 // -1 hour
    const deltaMs = deltaSlots * 30 * 60 * 1000

    const resizedMon = applyDeltaMs(wMonday, 'top', deltaMs)
    const resizedTue = applyDeltaMs(wTuesday, 'top', deltaMs)

    expect(resizedMon.startTime).toBe('08:00')
    expect(resizedTue.startTime).toBe('08:00')

    expect(resizedMon.scheduledDate).toBe('2026-06-08')
    expect(resizedTue.scheduledDate).toBe('2026-06-09')
  })

  it('undo restores exact original startsAt/endsAt', () => {
    const deltaMs = 2 * 30 * 60 * 1000
    const resizedMon = applyDeltaMs(wMonday, 'bottom', deltaMs)

    // Simulate undo: apply inverse delta
    const undone = applyDeltaMs(resizedMon, 'bottom', -deltaMs)

    expect(undone.startsAt).toBe(wMonday.startsAt)
    expect(undone.endsAt).toBe(wMonday.endsAt)
    expect(undone.scheduledDate).toBe(wMonday.scheduledDate)
    expect(undone.endDate).toBe(wMonday.endDate)
  })

  it('multi-day window: resize preserves both start and end dates', () => {
    const wMultiDay = new WorkWindow({
      id: 'w-multi',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-08T22:00:00-05:00', // Monday 10pm
      ends_at: '2026-06-09T06:00:00-05:00',   // Tuesday 6am
    })

    const deltaMs = 2 * 30 * 60 * 1000 // +1 hour
    const resized = applyDeltaMs(wMultiDay, 'bottom', deltaMs)

    expect(resized.endTime).toBe('07:00')
    expect(resized.scheduledDate).toBe('2026-06-08') // start date preserved
    expect(resized.endDate).toBe('2026-06-09')       // end date preserved (Tuesday)
    expect(resized.spansMultipleDays).toBe(true)
  })

  it('group resize: windows with different endTimes each shift by same delta', () => {
    // Simulates resizeGroup delta logic: group.endHour = 17 (max), new endTime = 18:00
    // Delta = +1 hour applied to each window individually
    const wShort = new WorkWindow({
      id: 'w-short',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-08T09:00:00-05:00',
      ends_at: '2026-06-08T15:00:00-05:00', // ends at 15:00
    })

    const wLong = new WorkWindow({
      id: 'w-long',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-08T09:00:00-05:00',
      ends_at: '2026-06-08T17:00:00-05:00', // ends at 17:00
    })

    // Group endHour = 17 (max of members). New endTime = 18:00 → delta = +1hr
    const groupEndHour = 17
    const newEndMinutes = 18 * 60
    const groupEndMinutes = groupEndHour * 60
    const deltaMs = (newEndMinutes - groupEndMinutes) * 60 * 1000 // +1hr

    const resizedShort = applyDeltaMs(wShort, 'bottom', deltaMs)
    const resizedLong = applyDeltaMs(wLong, 'bottom', deltaMs)

    // Each window should shift by +1hr from its OWN endTime
    expect(resizedShort.endTime).toBe('16:00') // was 15:00 → +1hr
    expect(resizedLong.endTime).toBe('18:00')  // was 17:00 → +1hr

    // They must NOT be flattened to the same endTime
    expect(resizedShort.endTime).not.toBe(resizedLong.endTime)

    // Dates preserved
    expect(resizedShort.endDate).toBe('2026-06-08')
    expect(resizedLong.endDate).toBe('2026-06-08')
  })
})

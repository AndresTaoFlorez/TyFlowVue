/**
 * Bug 3 — Multi-day window proxy handle visibility & resize correctness.
 *
 * Tests that:
 * 1. Start day off-screen → edge proxy exposes start handle (multiDayPos !== 'last'/'middle')
 * 2. End day off-screen → edge proxy exposes end handle (multiDayPos !== 'first'/'middle')
 * 3. Both boundaries off-screen → both handles visible
 * 4. Top-resize on off-screen-start proxy preserves correct original start date
 */
import { describe, it, expect } from 'vitest'
import { WorkWindow } from '@/domain/entities/WorkWindow.js'

// Reproduce windowsByDay proxy logic from WeekCalendar
function buildProxies(window, weekDates) {
  const numDays = weekDates.length
  const startIdx = weekDates.indexOf(window.scheduledDate)
  const endIdx = weekDates.indexOf(window.endDate)
  const first = Math.max(startIdx === -1 ? 0 : startIdx, 0)
  const last = Math.min(endIdx === -1 ? numDays - 1 : endIdx, numDays - 1)
  if (startIdx === -1 && endIdx === -1) return []
  const proxies = []
  for (let d = first; d <= last; d++) {
    const isFirst = d === startIdx || (startIdx === -1 && d === first)
    const isLast = d === endIdx || (endIdx === -1 && d === last)
    proxies.push({
      _multiDayProxy: true,
      _isFirstDay: isFirst,
      _isLastDay: isLast,
      _dayIndex: d,
      _originalWindow: window,
    })
  }
  return proxies
}

// Reproduce _multiDayPos from WeekCalendar
function multiDayPos(w) {
  if (!w._multiDayProxy) return null
  if (w._isFirstDay && w._isLastDay) return null // both handles needed
  if (w._isFirstDay) return 'first'
  if (w._isLastDay) return 'last'
  return 'middle'
}

// Reproduce WindowBlock handle visibility
function showTopHandle(pos) {
  if (pos === 'last' || pos === 'middle') return false
  return true
}
function showBottomHandle(pos) {
  if (pos === 'first' || pos === 'middle') return false
  return true
}

// Reproduce absolute-instant resize from _applyDeltaMs
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

describe('Bug 3 — multi-day proxy handle visibility', () => {
  // Window: Friday 10pm → Saturday 6am
  // Visible week: Mon–Sun (2026-06-08 to 2026-06-14)
  const weekDates = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14']

  it('start day off-screen → first visible proxy exposes start handle', () => {
    // Window starts Friday (off-screen), ends Monday (in week)
    const w = new WorkWindow({
      id: 'w-cross',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-05T22:00:00-05:00', // Friday (not in weekDates)
      ends_at: '2026-06-08T06:00:00-05:00',   // Monday (index 0)
      is_active: true,
    })

    const proxies = buildProxies(w, weekDates)
    expect(proxies.length).toBe(1) // only Monday is visible

    const pos = multiDayPos(proxies[0])
    // Both flags true → pos is null → both handles visible
    expect(proxies[0]._isFirstDay).toBe(true)
    expect(proxies[0]._isLastDay).toBe(true)
    expect(pos).toBeNull()
    expect(showTopHandle(pos)).toBe(true)
    expect(showBottomHandle(pos)).toBe(true)
  })

  it('end day off-screen → last visible proxy exposes end handle', () => {
    // Window starts Sunday (in week), ends Monday next week (off-screen)
    const w = new WorkWindow({
      id: 'w-cross2',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-14T20:00:00-05:00', // Sunday (index 6)
      ends_at: '2026-06-15T08:00:00-05:00',   // Monday next week (not in weekDates)
      is_active: true,
    })

    const proxies = buildProxies(w, weekDates)
    expect(proxies.length).toBe(1) // only Sunday is visible

    const pos = multiDayPos(proxies[0])
    expect(proxies[0]._isFirstDay).toBe(true)
    expect(proxies[0]._isLastDay).toBe(true)
    expect(pos).toBeNull()
    expect(showTopHandle(pos)).toBe(true)
    expect(showBottomHandle(pos)).toBe(true)
  })

  it('both days in week → first proxy has top handle, last has bottom', () => {
    // Window: Monday 10pm → Tuesday 6am, both in weekDates
    const w = new WorkWindow({
      id: 'w-normal',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-08T22:00:00-05:00', // Monday
      ends_at: '2026-06-09T06:00:00-05:00',   // Tuesday
      is_active: true,
    })

    const proxies = buildProxies(w, weekDates)
    expect(proxies.length).toBe(2)

    const posFirst = multiDayPos(proxies[0])
    expect(posFirst).toBe('first')
    expect(showTopHandle(posFirst)).toBe(true)
    expect(showBottomHandle(posFirst)).toBe(false)

    const posLast = multiDayPos(proxies[1])
    expect(posLast).toBe('last')
    expect(showTopHandle(posLast)).toBe(false)
    expect(showBottomHandle(posLast)).toBe(true)
  })
})

describe('Bug 3 — top-resize on off-screen-start proxy preserves correct date', () => {
  it('top-resize shifts starts_at without changing the date to the visible day', () => {
    // Window starts Friday 10pm, ends Monday 6am. Only Monday is visible.
    const w = new WorkWindow({
      id: 'w-cross',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-05T22:00:00-05:00', // Friday
      ends_at: '2026-06-08T06:00:00-05:00',   // Monday
      is_active: true,
    })

    // Simulate top-resize: drag up by 2 slots (1 hour earlier)
    const deltaMs = -2 * 30 * 60 * 1000 // -1 hour
    const resized = applyDeltaMs(w, 'top', deltaMs)

    // Start time should be 21:00 (was 22:00, moved 1 hour earlier)
    expect(resized.startTime).toBe('21:00')
    // CRITICAL: start date must remain Friday, NOT shift to visible Monday
    expect(resized.scheduledDate).toBe('2026-06-05')
    // End remains unchanged
    expect(resized.endsAt).toBe(w.endsAt)
    expect(resized.endDate).toBe('2026-06-08')
  })

  it('modal edit path: startsAt and endsAt are independently editable for multi-day windows', () => {
    // Simulates what WorkWindowModal.saveEdit() does
    const w = new WorkWindow({
      id: 'w-multi',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-08T22:00:00-05:00',
      ends_at: '2026-06-09T06:00:00-05:00',
      is_active: true,
    })

    // Modal would call: editStartDate = dateFromTimestamp(startsAt) → '2026-06-08'
    //                    editEndDate = dateFromTimestamp(endsAt) → '2026-06-09'
    // On save, emits: { targetDate: editStartDate, endDate: editEndDate, startTime, endTime }
    const editData = {
      targetDate: '2026-06-08',
      endDate: '2026-06-09',
      startTime: '21:00', // changed from 22:00
      endTime: '07:00',   // changed from 06:00
    }

    // Reconstruct as BatchUpdateWorkWindowsUseCase would
    const newStartsAt = WorkWindow.toTimestampTz(editData.targetDate, editData.startTime)
    const newEndsAt = WorkWindow.toTimestampTz(editData.endDate, editData.endTime)

    expect(newStartsAt).toContain('2026-06-08')
    expect(newStartsAt).toContain('21:00')
    expect(newEndsAt).toContain('2026-06-09')
    expect(newEndsAt).toContain('07:00')

    // Dates are independent — changing start doesn't affect end date
    const rebuilt = new WorkWindow({
      ...w._toRaw(),
      starts_at: newStartsAt,
      ends_at: newEndsAt,
    })
    expect(rebuilt.scheduledDate).toBe('2026-06-08')
    expect(rebuilt.endDate).toBe('2026-06-09')
    expect(rebuilt.spansMultipleDays).toBe(true)
  })
})

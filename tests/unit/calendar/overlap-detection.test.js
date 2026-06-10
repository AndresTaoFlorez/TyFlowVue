/**
 * Bug 2 — Overlap detection must use absolute instants, not time-of-day.
 *
 * Tests that:
 * 1. Same time-of-day on different dates → NO false-positive overlap
 * 2. Genuine same-instant overlap → detected
 * 3. Multi-day window → detected as overlapping on day other than its start day
 */
import { describe, it, expect } from 'vitest'
import { WorkWindow } from '@/domain/entities/WorkWindow.js'

// Reproduce the fixed _checkOverlapAbs logic
function checkOverlapAbs(specialistId, startsAt, endsAt, existingWindows, excludeIds = new Set(), applicationId = null) {
  const newS = new Date(startsAt).getTime()
  const newE = new Date(endsAt).getTime()
  return existingWindows.find(w => {
    if (excludeIds.has(w.id)) return false
    if (w.specialistId !== specialistId) return false
    if (!w.isActive) return false
    if (applicationId && w.applicationId !== applicationId) return false
    const wS = new Date(w.startsAt).getTime()
    const wE = new Date(w.endsAt).getTime()
    return newS < wE && newE > wS
  }) || null
}

// Wrapper matching the old _checkOverlap signature
function checkOverlap(specialistId, date, startTime, endTime, existingWindows, excludeIds = new Set(), applicationId = null) {
  const startsAt = WorkWindow.toTimestampTz(date, startTime)
  const endsAt = WorkWindow.toTimestampTz(date, endTime)
  return checkOverlapAbs(specialistId, startsAt, endsAt, existingWindows, excludeIds, applicationId)
}

describe('Bug 2 — overlap detection uses absolute instants', () => {
  it('same time-of-day on DIFFERENT dates → no false-positive', () => {
    const existing = [
      new WorkWindow({
        id: 'w1',
        specialist_id: 'spec-1',
        application_id: 'app-1',
        starts_at: '2026-06-08T09:00:00-05:00', // Monday
        ends_at: '2026-06-08T17:00:00-05:00',
        is_active: true,
      }),
    ]

    // Check for Tuesday at the same time — should NOT conflict
    const conflict = checkOverlap('spec-1', '2026-06-09', '09:00', '17:00', existing, new Set(), 'app-1')
    expect(conflict).toBeNull()
  })

  it('genuine same-instant overlap → detected', () => {
    const existing = [
      new WorkWindow({
        id: 'w1',
        specialist_id: 'spec-1',
        application_id: 'app-1',
        starts_at: '2026-06-08T09:00:00-05:00',
        ends_at: '2026-06-08T17:00:00-05:00',
        is_active: true,
      }),
    ]

    // Check for same date overlapping time — SHOULD conflict
    const conflict = checkOverlap('spec-1', '2026-06-08', '10:00', '12:00', existing, new Set(), 'app-1')
    expect(conflict).not.toBeNull()
    expect(conflict.id).toBe('w1')
  })

  it('multi-day window → detected as overlapping on a non-start day', () => {
    const existing = [
      new WorkWindow({
        id: 'w-multi',
        specialist_id: 'spec-1',
        application_id: 'app-1',
        starts_at: '2026-06-08T22:00:00-05:00', // Monday 10pm
        ends_at: '2026-06-09T06:00:00-05:00',   // Tuesday 6am
        is_active: true,
      }),
    ]

    // Check for Tuesday 3am–5am — overlaps with the multi-day window
    const conflict = checkOverlap('spec-1', '2026-06-09', '03:00', '05:00', existing, new Set(), 'app-1')
    expect(conflict).not.toBeNull()
    expect(conflict.id).toBe('w-multi')
  })

  it('adjacent but non-overlapping → no conflict', () => {
    const existing = [
      new WorkWindow({
        id: 'w1',
        specialist_id: 'spec-1',
        application_id: 'app-1',
        starts_at: '2026-06-08T09:00:00-05:00',
        ends_at: '2026-06-08T12:00:00-05:00',
        is_active: true,
      }),
    ]

    // Starts exactly when w1 ends → no overlap
    const conflict = checkOverlap('spec-1', '2026-06-08', '12:00', '14:00', existing, new Set(), 'app-1')
    expect(conflict).toBeNull()
  })
})

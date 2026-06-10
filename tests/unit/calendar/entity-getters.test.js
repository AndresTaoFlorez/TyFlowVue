/**
 * Bug 6 — Modal editability flags must match entity getters.
 *
 * Verifies that the entity's temporal getters (isFuture, isInShift, isEnded,
 * canEdit, canToggle) produce correct results for each temporal state, and
 * that the modal would consume them correctly.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { WorkWindow } from '@/domain/entities/WorkWindow.js'

afterEach(() => { vi.useRealTimers() })

describe('Bug 6 — entity temporal getters', () => {
  it('future window: isFuture=true, isSealed=false, isInShift=false, isEnded=false, canEdit=true, canToggle=true', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T08:00:00-05:00'))

    const w = new WorkWindow({
      id: 'w1',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-09T09:00:00-05:00',
      ends_at: '2026-06-09T17:00:00-05:00',
      is_active: true,
    })

    expect(w.isFuture).toBe(true)
    expect(w.isSealed).toBe(false)
    expect(w.isInShift).toBe(false)
    expect(w.isEnded).toBe(false)
    expect(w.canEdit).toBe(true)
    expect(w.canToggle).toBe(true)
  })

  it('in-shift window: isFuture=false, isSealed=true, isInShift=true, isEnded=false, canEdit=false, canToggle=true', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T12:00:00-05:00'))

    const w = new WorkWindow({
      id: 'w2',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-09T09:00:00-05:00',
      ends_at: '2026-06-09T17:00:00-05:00',
      is_active: true,
    })

    expect(w.isFuture).toBe(false)
    expect(w.isSealed).toBe(true)
    expect(w.isInShift).toBe(true)
    expect(w.isEnded).toBe(false)
    expect(w.canEdit).toBe(false)
    expect(w.canToggle).toBe(true)
  })

  it('ended window: isFuture=false, isSealed=true, isInShift=false, isEnded=true, canEdit=false, canToggle=false', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T18:00:00-05:00'))

    const w = new WorkWindow({
      id: 'w3',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-09T09:00:00-05:00',
      ends_at: '2026-06-09T17:00:00-05:00',
      is_active: true,
    })

    expect(w.isFuture).toBe(false)
    expect(w.isSealed).toBe(true)
    expect(w.isInShift).toBe(false)
    expect(w.isEnded).toBe(true)
    expect(w.canEdit).toBe(false)
    expect(w.canToggle).toBe(false)
  })

  it('inactive in-shift window: isInShift still true (entity does not check isActive)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T12:00:00-05:00'))

    const w = new WorkWindow({
      id: 'w4',
      specialist_id: 'spec-1',
      application_id: 'app-1',
      starts_at: '2026-06-09T09:00:00-05:00',
      ends_at: '2026-06-09T17:00:00-05:00',
      is_active: false,
    })

    // Entity's isInShift checks time range only, not isActive
    expect(w.isInShift).toBe(true)
    expect(w.canToggle).toBe(true)
  })
})

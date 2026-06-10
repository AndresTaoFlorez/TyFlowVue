/**
 * @vitest-environment jsdom
 *
 * Tests for RT deduplication, batch cache invalidation, and create race condition fixes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { WorkWindow } from '@/domain/entities/WorkWindow.js'

// Mock all dependencies the store imports via @/ alias
vi.mock('@/application/use-cases/work-windows/FetchWorkWindowsUseCase', () => ({
  fetchWorkWindowsUseCase: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@/application/use-cases/work-windows/CreateWorkWindowUseCase', () => ({
  createWorkWindowUseCase: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@/application/use-cases/work-windows/DeleteWorkWindowUseCase', () => ({
  deleteWorkWindowUseCase: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/application/use-cases/work-windows/UpdateWorkWindowUseCase', () => ({
  updateWorkWindowUseCase: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('@/application/use-cases/work-windows/RescheduleWorkWindowUseCase', () => ({
  rescheduleWorkWindowUseCase: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('@/application/use-cases/work-windows/ToggleWorkWindowUseCase', () => ({
  toggleWorkWindowUseCase: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('@/application/use-cases/work-windows/DisinheritWorkWindowUseCase', () => ({
  disinheritWorkWindowUseCase: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@/application/use-cases/work-windows/InheritWorkWindowUseCase', () => ({
  inheritWorkWindowUseCase: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@/application/use-cases/work-windows/MergeWorkWindowsUseCase', () => ({
  mergeWorkWindowsUseCase: vi.fn(() => Promise.resolve({ mode: 'homogeneous', windows: [], deletedIds: [] })),
}))
vi.mock('@/application/use-cases/work-windows/BatchUpdateWorkWindowsUseCase', () => ({
  batchUpdateWorkWindowsUseCase: vi.fn(() => Promise.resolve({ updated: [], failed: [] })),
}))
vi.mock('@/infrastructure/repositories/WorkWindowRepository', () => ({
  WorkWindowRepository: {
    fetchAll: vi.fn(() => Promise.resolve([])),
    fetchById: vi.fn(() => Promise.resolve(null)),
    toggleWindows: vi.fn(() => Promise.resolve([])),
  },
}))
vi.mock('@/infrastructure/sync/SyncEngine', () => ({
  SyncEngine: class {
    loadFromCache() { return [] }
    writeToCache() {}
  },
}))
vi.mock('@/presentation/stores/useUserStore', () => ({
  useUserStore: () => ({ users: [], applications: [] }),
}))
vi.mock('@/infrastructure/logger', () => ({
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function makeRaw(id, date = '2026-06-10', startTime = '08:00', endTime = '17:00') {
  return {
    id,
    specialist_id: 'spec-1',
    application_id: 'app-1',
    starts_at: `${date}T${startTime}:00-05:00`,
    ends_at: `${date}T${endTime}:00-05:00`,
    is_active: true,
  }
}

describe('onWindowCreatedRT — dedup', async () => {
  const { useCalendarStore } = await import('@/presentation/stores/useCalendarStore.js')
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useCalendarStore()
    store.windows = []
  })

  it('does NOT add a window if the ID already exists', () => {
    const raw = makeRaw('ww-1')
    store.windows = [new WorkWindow(raw)]

    store.onWindowCreatedRT(raw)

    expect(store.windows.length).toBe(1)
  })

  it('adds a window if the ID is new', () => {
    store.windows = [new WorkWindow(makeRaw('ww-1'))]

    store.onWindowCreatedRT(makeRaw('ww-2'))

    expect(store.windows.length).toBe(2)
    expect(store.windows.map(w => w.id)).toContain('ww-2')
  })

  it('handles array payload (API contract: work_window.created is always an array)', () => {
    store.windows = [new WorkWindow(makeRaw('ww-1'))]

    store.onWindowCreatedRT([makeRaw('ww-1'), makeRaw('ww-3')])

    expect(store.windows.length).toBe(2)
    expect(store.windows.map(w => w.id)).toEqual(['ww-1', 'ww-3'])
  })
})

describe('createWindows — race condition with RT', async () => {
  const { createWorkWindowUseCase } = await import('@/application/use-cases/work-windows/CreateWorkWindowUseCase')
  const { useCalendarStore } = await import('@/presentation/stores/useCalendarStore.js')
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useCalendarStore()
    store.windows = []
  })

  it('does not duplicate when RT inserts the window before API response', async () => {
    const createdWindow = new WorkWindow(makeRaw('real-1'))
    createWorkWindowUseCase.mockResolvedValueOnce([createdWindow])

    const createPromise = store.createWindows([{
      specialistId: 'spec-1',
      applicationId: 'app-1',
      startTime: '08:00',
      endTime: '17:00',
      scheduledDate: '2026-06-10',
    }])

    // Before API responds, RT arrives with the real window
    store.onWindowCreatedRT(makeRaw('real-1'))

    await createPromise

    const realWindows = store.windows.filter(w => !w.id.startsWith('__new_'))
    expect(realWindows.length).toBe(1)
    expect(realWindows[0].id).toBe('real-1')
  })
})

describe('onWindowBatchRT — cache invalidation', async () => {
  const { fetchWorkWindowsUseCase } = await import('@/application/use-cases/work-windows/FetchWorkWindowsUseCase')
  const { useCalendarStore } = await import('@/presentation/stores/useCalendarStore.js')
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useCalendarStore()
    fetchWorkWindowsUseCase.mockReset()
    fetchWorkWindowsUseCase.mockResolvedValue([])
  })

  it('forces a re-fetch even if the range was already cached', async () => {
    await store.loadWindows()
    const callsAfterInit = fetchWorkWindowsUseCase.mock.calls.length

    // loadWindows again → no-op (range covered)
    await store.loadWindows()
    expect(fetchWorkWindowsUseCase.mock.calls.length).toBe(callsAfterInit)

    // work_window.batch → should invalidate and re-fetch
    store.onWindowBatchRT({})
    await new Promise(r => setTimeout(r, 50))

    expect(fetchWorkWindowsUseCase.mock.calls.length).toBeGreaterThan(callsAfterInit)
  })
})

describe('forceReload — bypasses cache', async () => {
  const { fetchWorkWindowsUseCase } = await import('@/application/use-cases/work-windows/FetchWorkWindowsUseCase')
  const { useCalendarStore } = await import('@/presentation/stores/useCalendarStore.js')
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useCalendarStore()
    fetchWorkWindowsUseCase.mockReset()
    fetchWorkWindowsUseCase.mockResolvedValue([])
  })

  it('re-fetches even when range is already cached', async () => {
    await store.loadWindows()
    const callsAfterInit = fetchWorkWindowsUseCase.mock.calls.length

    await store.forceReload()

    expect(fetchWorkWindowsUseCase.mock.calls.length).toBeGreaterThan(callsAfterInit)
  })
})

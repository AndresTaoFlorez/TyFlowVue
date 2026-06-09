import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { fetchWorkWindowsUseCase } from '@/application/use-cases/work-windows/FetchWorkWindowsUseCase'
import { createWorkWindowUseCase } from '@/application/use-cases/work-windows/CreateWorkWindowUseCase'
import { deleteWorkWindowUseCase } from '@/application/use-cases/work-windows/DeleteWorkWindowUseCase'
import { updateWorkWindowUseCase } from '@/application/use-cases/work-windows/UpdateWorkWindowUseCase'
import { rescheduleWorkWindowUseCase } from '@/application/use-cases/work-windows/RescheduleWorkWindowUseCase'
import { toggleWorkWindowUseCase } from '@/application/use-cases/work-windows/ToggleWorkWindowUseCase'
import { disinheritWorkWindowUseCase } from '@/application/use-cases/work-windows/DisinheritWorkWindowUseCase'
import { inheritWorkWindowUseCase } from '@/application/use-cases/work-windows/InheritWorkWindowUseCase'
import { mergeWorkWindowsUseCase } from '@/application/use-cases/work-windows/MergeWorkWindowsUseCase'
import { batchUpdateWorkWindowsUseCase } from '@/application/use-cases/work-windows/BatchUpdateWorkWindowsUseCase'
import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { SyncEngine } from '@/infrastructure/sync/SyncEngine'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { fmtHM } from '@/presentation/helpers/formatTime'
import { fmtDateISO } from '@/presentation/helpers/formatDate'
import { BP_MOBILE } from '@/presentation/utils/breakpoints'

export const useCalendarStore = defineStore('calendar', () => {
  // ---- Navigation ----
  const calView = ref(window.innerWidth < BP_MOBILE ? 'day' : 'week')
  const weekOffset = ref(0)
  const dayOffset = ref(0)
  const monthOffset = ref(0)

  // ---- SyncEngine (cache persistence) ----
  const _sync = new SyncEngine({
    cacheKey: 'tyflow_work_windows',
    hydrate: (raw) => new WorkWindow(raw),
    fetchRemote: () => Promise.resolve([]),   // range-based fetch, not used
    getId: (item) => item.id,
  })

  // ---- Windows ----
  const windows = ref(_sync.loadFromCache())
  const loading = ref(false)

  // ---- Fetched range tracking (accumulative strategy) ----
  const _fetchedRanges = []        // Array of { from, to } ISO date ranges already loaded
  let _initialLoadDone = false
  const _prefetchInFlight = new Set()

  // ---- Undo stack ----
  const _undoStack = ref([])
  const MAX_UNDO = 30
  const canUndo = computed(() => _undoStack.value.length > 0)

  function _pushUndo(snapshot, undoFn) {
    _undoStack.value.push({ snapshot, undo: undoFn })
    if (_undoStack.value.length > MAX_UNDO) _undoStack.value.shift()
  }

  async function undo() {
    if (_undoStack.value.length === 0) return
    const entry = _undoStack.value.pop()
    // Optimistic: restore snapshot immediately
    windows.value = entry.snapshot
    // Clear all fetched ranges so next navigation re-fetches fresh data
    _fetchedRanges.length = 0
    // Backend: reverse the operation
    try {
      await entry.undo()
    } catch {
      // errors handled silently
    }
    // Re-fetch current view (silent — windows.value has snapshot data)
    await loadWindows()
  }

  // ---- Density ----
  const DENSITY_KEY = 'tyflow_cal_density'
  const density = ref(localStorage.getItem(DENSITY_KEY) || 'comfortable')

  function setDensity(val) {
    density.value = val
    localStorage.setItem(DENSITY_KEY, val)
  }

  // ---- Filters ----
  const filtroSpecialist = ref('all')
  const filtroApp = ref('all')

  // ---- Computed dates ----
  const weekDates = computed(() => {
    if (calView.value === 'month') {
      return monthDates.value.length
        ? [monthDates.value[0], monthDates.value[monthDates.value.length - 1]]
        : []
    }
    if (calView.value === 'day') {
      const d = new Date()
      d.setDate(d.getDate() + dayOffset.value)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return [`${y}-${m}-${dd}`]
    }
    const now = new Date()
    const monday = new Date(now)
    const day = monday.getDay()
    const diff = day === 0 ? -6 : 1 - day
    monday.setDate(monday.getDate() + diff + weekOffset.value * 7)
    monday.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return fmtDateISO(d)
    })
  })

  const monthDates = computed(() => {
    if (calView.value !== 'month') return []
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
    const day = first.getDay()
    const toMonday = day === 0 ? -6 : 1 - day
    const start = new Date(first)
    start.setDate(first.getDate() + toMonday)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return fmtDateISO(d)
    })
  })

  const currentMonth = computed(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
    return d.getMonth()
  })

  // ---- Label ----
  const isMobile = ref(window.innerWidth < BP_MOBILE)

  const weekLabel = computed(() => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const mesesLargo = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    if (calView.value === 'month') {
      const now = new Date()
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
      return `${mesesLargo[d.getMonth()]} ${d.getFullYear()}`
    }
    if (calView.value === 'day') {
      const diasCorto = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const diasLargo = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const parts = weekDates.value[0].split('-')
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      const dayName = isMobile.value ? diasCorto[dateObj.getDay()] : diasLargo[dateObj.getDay()]
      return `${dayName}, ${parseInt(parts[2])} ${meses[parseInt(parts[1]) - 1]}`
    }
    const first = weekDates.value[0].split('-')
    const last = weekDates.value[6].split('-')
    const firstMonth = parseInt(first[1]) - 1
    const lastMonth = parseInt(last[1]) - 1
    if (firstMonth !== lastMonth) {
      return `${parseInt(first[2])} ${meses[firstMonth]} – ${parseInt(last[2])} ${meses[lastMonth]} ${last[0]}`
    }
    return `${parseInt(first[2])} – ${parseInt(last[2])} ${meses[lastMonth]} ${last[0]}`
  })

  // ---- Filtered windows ----
  const windowsFiltradas = computed(() => {
    const from = weekDates.value[0]
    const to = weekDates.value[weekDates.value.length - 1]

    return windows.value.filter(w => {
      // Filter by current view date range to avoid stale cross-view data
      if (from && to && w.scheduledDate) {
        if (w.scheduledDate < from || w.scheduledDate > to) return false
      }
      if (filtroSpecialist.value !== 'all' && w.specialistId !== filtroSpecialist.value) return false
      if (filtroApp.value !== 'all' && w.applicationId !== filtroApp.value) return false
      return true
    })
  })

  // ---- Filter options (based on loaded windows) ----
  const specialistsConVentana = computed(() => {
    const userStore = useUserStore()
    return userStore.users.filter(u => u.specialistId && u.isActive && u.specialistIsActive !== false)
  })

  const specOptions = computed(() => {
    const ids = new Set(windows.value.map(w => w.specialistId))
    return specialistsConVentana.value.filter(u => ids.has(u.specialistId))
  })

  const appOptions = computed(() => {
    const userStore = useUserStore()
    const ids = new Set(windows.value.map(w => w.applicationId))
    return userStore.applications.filter(a => ids.has(a.id))
  })

  // ---- Sync offsets when switching views (preserves the currently visible date) ----
  let _skipViewSync = false
  watch(calView, (newView, oldView) => {
    if (_skipViewSync) { _skipViewSync = false; return }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Compute anchor date from the PREVIOUS view before it changes
    let anchor = new Date(today)
    if (oldView === 'day') {
      anchor.setDate(today.getDate() + dayOffset.value)
    } else if (oldView === 'week') {
      const dow = today.getDay()
      const toMon = dow === 0 ? -6 : 1 - dow
      anchor.setDate(today.getDate() + toMon + weekOffset.value * 7)
      anchor.setHours(0, 0, 0)
    } else if (oldView === 'month') {
      anchor = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
    }

    // Set the new view's offset so it shows the anchor date
    if (newView === 'day') {
      dayOffset.value = Math.round((anchor.getTime() - today.getTime()) / 86400000)
    } else if (newView === 'week') {
      const aDow = anchor.getDay()
      const anchorMon = new Date(anchor)
      anchorMon.setDate(anchor.getDate() + (aDow === 0 ? -6 : 1 - aDow))
      const tDow = today.getDay()
      const todayMon = new Date(today)
      todayMon.setDate(today.getDate() + (tDow === 0 ? -6 : 1 - tDow))
      weekOffset.value = Math.round((anchorMon.getTime() - todayMon.getTime()) / (7 * 86400000))
    } else if (newView === 'month') {
      monthOffset.value = (anchor.getFullYear() - today.getFullYear()) * 12 + (anchor.getMonth() - today.getMonth())
    }
  })

  // ---- Cache persistence (debounced) ----
  let _cacheTimer = null
  watch(windows, (val) => {
    clearTimeout(_cacheTimer)
    _cacheTimer = setTimeout(() => _sync.writeToCache(val), 200)
  })

  // ---- Range helpers ----
  const _fmtDate = fmtDateISO

  function _isRangeCovered(from, to) {
    // Union-of-ranges: check if overlapping/adjacent fetched ranges cover [from, to]
    const overlapping = _fetchedRanges
      .filter(r => r.to >= from && r.from <= to)
      .sort((a, b) => a.from.localeCompare(b.from))
    if (overlapping.length === 0) return false
    if (overlapping[0].from > from) return false
    let coveredTo = overlapping[0].to
    for (let i = 1; i < overlapping.length; i++) {
      if (overlapping[i].from > _addDays(coveredTo, 1)) return false
      if (overlapping[i].to > coveredTo) coveredTo = overlapping[i].to
    }
    return coveredTo >= to
  }

  function _getInitialRange() {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    return { from: _fmtDate(from), to: _fmtDate(to) }
  }

  async function _fetchRange(from, to) {
    const tzOffset = WorkWindow.toTimestampTz(from, '00:00')?.slice(-6) || '-05:00'
    return await fetchWorkWindowsUseCase({
      date_from: `${from}T00:00:00${tzOffset}`,
      date_to: `${to}T23:59:59${tzOffset}`,
    })
  }

  function _mergeWindows(fetched, fromDate, toDate) {
    // Replace all windows in [fromDate, toDate] with fetched data;
    // keep windows outside that range untouched.
    windows.value = [
      ...windows.value.filter(w => w.scheduledDate < fromDate || w.scheduledDate > toDate),
      ...fetched,
    ]
  }

  /** Compute the 42-cell grid range for a given month offset (same algo as monthDates) */
  function _monthGridRange(offset) {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const day = first.getDay()
    const toMonday = day === 0 ? -6 : 1 - day
    const start = new Date(first)
    start.setDate(first.getDate() + toMonday)
    const end = new Date(start)
    end.setDate(start.getDate() + 41) // 42 cells
    return { from: _fmtDate(start), to: _fmtDate(end) }
  }

  function _prefetchAdjacent() {
    const ranges = []
    if (calView.value === 'week') {
      const first = weekDates.value[0]
      const last = weekDates.value[weekDates.value.length - 1]
      ranges.push({ from: _addDays(first, -7), to: _addDays(first, -1) })
      ranges.push({ from: _addDays(last, 1), to: _addDays(last, 7) })
    } else if (calView.value === 'day') {
      const day = weekDates.value[0]
      ranges.push({ from: _addDays(day, -7), to: _addDays(day, -1) })
      ranges.push({ from: _addDays(day, 1), to: _addDays(day, 7) })
    } else if (calView.value === 'month') {
      // Use full 42-cell grid range so swiped-to month data is ready
      ranges.push(_monthGridRange(monthOffset.value - 1))
      ranges.push(_monthGridRange(monthOffset.value + 1))
    }
    for (const { from, to } of ranges) {
      if (_isRangeCovered(from, to)) continue
      const key = `${from}|${to}`
      if (_prefetchInFlight.has(key)) continue
      _prefetchInFlight.add(key)
      _fetchRange(from, to)
        .then(result => {
          _mergeWindows(result, from, to)
          _fetchedRanges.push({ from, to })
        })
        .catch(() => {})
        .finally(() => _prefetchInFlight.delete(key))
    }
  }

  // ---- Load windows (accumulative strategy) ----
  async function loadWindows() {
    const fromDate = weekDates.value[0]
    const toDate = weekDates.value[weekDates.value.length - 1]
    if (!fromDate || !toDate) return

    // Already covered → instant, just prefetch neighbors
    if (_isRangeCovered(fromDate, toDate)) {
      _prefetchAdjacent()
      return
    }

    let fetchFrom = fromDate
    let fetchTo = toDate

    // First load: wide 3-month range with spinner
    if (!_initialLoadDone) {
      const range = _getInitialRange()
      fetchFrom = range.from < fromDate ? range.from : fromDate
      fetchTo = range.to > toDate ? range.to : toDate
      loading.value = true
      _initialLoadDone = true
    }
    // Subsequent loads: silent (no spinner, no clearing windows)

    try {
      const result = await _fetchRange(fetchFrom, fetchTo)
      _mergeWindows(result, fetchFrom, fetchTo)
      _fetchedRanges.push({ from: fetchFrom, to: fetchTo })
    } catch (e) {
      throw e
    } finally {
      loading.value = false
    }

    _prefetchAdjacent()
  }

  // ---- Watch date changes → load ----
  watch([weekDates, monthDates], () => {
    loadWindows().catch(() => {})
  })

  // ---- Mutation helpers ----
  function _replaceWindow(id, updated) {
    if (!updated) return
    const idx = windows.value.findIndex(x => x.id === id)
    if (idx !== -1) {
      windows.value = [...windows.value.slice(0, idx), updated, ...windows.value.slice(idx + 1)]
    }
    _invalidateCache()
  }

  function _removeWindow(id) {
    windows.value = windows.value.filter(x => x.id !== id)
    _invalidateCache()
  }

  function _addWindows(newWindows) {
    windows.value = [...windows.value, ...newWindows]
    _invalidateCache()
  }

  function _invalidateCache() {
    // No-op: with accumulative windows, mutations update windows.value directly
  }

  function _deleteCurrentCache() {
    const fromDate = weekDates.value[0]
    const toDate = weekDates.value[weekDates.value.length - 1]
    for (let i = _fetchedRanges.length - 1; i >= 0; i--) {
      if (_fetchedRanges[i].from <= toDate && _fetchedRanges[i].to >= fromDate) {
        _fetchedRanges.splice(i, 1)
      }
    }
  }

  /** Remove specific window IDs — no-op, callers already update windows.value directly. */
  function _purgeFromAllCaches(idSet) {
  }

  function _addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + days)
    return fmtDateISO(d)
  }

  function _findOriginal(id) {
    return windows.value.find(x => x.id === id)
  }

  function _isPlaceholder(id) {
    return typeof id === 'string' && id.startsWith('__new_')
  }

  function _daysBetween(dateStrA, dateStrB) {
    const a = new Date(dateStrA + 'T12:00:00')
    const b = new Date(dateStrB + 'T12:00:00')
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
  }

  const _MESSAGE_MAP = [
    [/no previous window found.*specialist.*application/i, 'No existe una ventana anterior del mismo especialista y aplicación para heredar.'],
    [/no previous window found/i, 'No se encontró una ventana anterior para heredar.'],
    [/Cannot activate inheritance.*already started/i, 'No se puede activar herencia en una ventana que ya inició.'],
    [/Cannot disinherit.*already started/i, 'No se puede quitar la herencia de una ventana que ya inició.'],
    [/does not inherit/i, 'Esta ventana no tiene herencia activa.'],
    [/already inherits/i, 'Esta ventana ya tiene herencia activa.'],
    [/not found.*already deleted/i, 'Ventana no encontrada o ya fue eliminada.'],
    [/not found/i, 'Ventana de trabajo no encontrada.'],
  ]

  function _translateMessage(msg) {
    if (!msg) return ''
    const match = _MESSAGE_MAP.find(([pattern]) => pattern.test(msg))
    return match ? match[1] : msg
  }

  function _buildOptimistic(original, { startTime, endTime, targetDate, endDate }) {
    const startDate = targetDate || original.scheduledDate
    const finalEndDate = endDate || targetDate || original.endDate || original.scheduledDate
    const raw = original._toRaw()
    if (startTime != null) raw.starts_at = WorkWindow.toTimestampTz(startDate, startTime)
    else if (targetDate) raw.starts_at = WorkWindow.toTimestampTz(startDate, original.startTime)
    if (endTime != null) raw.ends_at = WorkWindow.toTimestampTz(finalEndDate, endTime)
    else if (targetDate || endDate) raw.ends_at = WorkWindow.toTimestampTz(finalEndDate, original.endTime)
    return new WorkWindow(raw)
  }

  function _windowToCreateData(w) {
    return {
      specialistId: w.specialistId,
      applicationId: w.applicationId,
      startTime: w.startTime,
      endTime: w.endTime,
      scheduledDate: w.scheduledDate,
      inheritsOnReopen: w.inheritsOnReopen || false,
    }
  }

  /**
   * Checks if moving a window to (date, startTime, endTime) would overlap
   * with another existing window of the same specialist.
   * @param {string} specialistId
   * @param {string} date - ISO date
   * @param {string} startTime - HH:MM
   * @param {string} endTime - HH:MM
   * @param {Set|Array} excludeIds - window IDs to exclude from check (the ones being moved)
   */
  /**
   * Validates inheritance constraints when moving/resizing a window.
   * - Child cannot start before parent ends.
   * - Parent cannot end after child starts.
   * @returns {string|null} Error message or null if valid.
   */
  function _checkInheritance(windowId, date, startTime, endTime) {
    const w = _findOriginal(windowId)
    if (!w) return null

    const newStartMins = _dateTimeToAbsMinutes(date, startTime)
    const newEndMins = _dateTimeToAbsMinutes(date, endTime)

    // Child constraint: can't start before parent ends
    if (w.inheritedFromWindowId) {
      const parent = _findOriginal(w.inheritedFromWindowId)
      if (parent) {
        const parentEndMins = _dateTimeToAbsMinutes(parent.endDate || parent.scheduledDate, parent.endTime)
        if (newStartMins < parentEndMins) {
          return 'No se puede mover antes de la ventana de la que hereda.'
        }
      }
    }

    // Parent constraint: can't end after any child starts
    const children = windows.value.filter(x => x.inheritedFromWindowId === windowId)
    for (const child of children) {
      const childStartMins = _dateTimeToAbsMinutes(child.scheduledDate, child.startTime)
      if (newEndMins > childStartMins) {
        return 'No se puede mover después de una ventana que hereda de esta.'
      }
    }

    return null
  }

  function _dateTimeToAbsMinutes(date, time) {
    const d = new Date(date + 'T12:00:00')
    const daysSinceEpoch = Math.floor(d.getTime() / (24 * 60 * 60 * 1000))
    return daysSinceEpoch * 24 * 60 + _timeToMinutes(time)
  }

  function _checkOverlap(specialistId, date, startTime, endTime, excludeIds = [], applicationId = null) {
    const startsAt = WorkWindow.toTimestampTz(date, startTime)
    const endsAt = WorkWindow.toTimestampTz(date, endTime)
    if (!startsAt || !endsAt) return null
    const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds)
    return _checkOverlapAbs(specialistId, startsAt, endsAt, exclude, applicationId)
  }

  function _isEnded(w) {
    return w.endsAt && new Date(w.endsAt) < new Date()
  }

  function _todayISO() {
    return fmtDateISO(new Date())
  }

  function _timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  /**
   * Apply a delta in milliseconds to a window's startsAt or endsAt (absolute-instant math).
   * Returns { optimistic: WorkWindow } with the shifted timestamp, preserving each window's own date.
   */
  function _applyDeltaMs(orig, direction, deltaMs) {
    const raw = orig._toRaw()
    if (direction === 'top') {
      const newStart = new Date(new Date(orig.startsAt).getTime() + deltaMs)
      raw.starts_at = _dateToTimestampTz(newStart)
    } else {
      const newEnd = new Date(new Date(orig.endsAt).getTime() + deltaMs)
      raw.ends_at = _dateToTimestampTz(newEnd)
    }
    return { optimistic: new WorkWindow(raw) }
  }

  /** Convert a Date object to a timestamptz string with local timezone offset */
  function _dateToTimestampTz(d) {
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

  /**
   * Overlap check using absolute instants (startsAt/endsAt) instead of time-of-day.
   * Correctly handles multi-day windows and windows on different dates.
   */
  function _checkOverlapAbs(specialistId, startsAt, endsAt, excludeIds = new Set(), applicationId = null) {
    const newS = new Date(startsAt).getTime()
    const newE = new Date(endsAt).getTime()
    return windows.value.find(w => {
      if (excludeIds.has(w.id)) return false
      if (w.specialistId !== specialistId) return false
      if (!w.isActive) return false
      if (applicationId && w.applicationId !== applicationId) return false
      const wS = new Date(w.startsAt).getTime()
      const wE = new Date(w.endsAt).getTime()
      return newS < wE && newE > wS
    }) || null
  }

  const _toHM = (decimal) => {
    const clamped = Math.max(0, Math.min(decimal, 24))
    const h = Math.floor(clamped)
    const m = Math.round((clamped % 1) * 60)
    return fmtHM(Math.min(h, 23), h >= 24 ? 0 : m)
  }

  // ---- CRUD Actions ----
  async function createWindows(data) {
    const now = new Date()
    for (const item of data) {
      const endDate = item.endDate || item.scheduledDate || _todayISO()
      const endsAt = WorkWindow.toTimestampTz(endDate, item.endTime || '23:59')
      if (endsAt && new Date(endsAt) < now) {
        throw { userMessage: 'No se pueden crear ventanas en horarios pasados.' }
      }
    }
    const snapshot = [...windows.value]

    // Optimistic: add placeholder windows immediately
    const placeholders = data.map((item, i) => {
      const date = item.scheduledDate || _todayISO()
      const endDate = item.endDate || date
      const raw = {
        id: '__new_' + Date.now() + '_' + i,
        specialist_id: item.specialistId,
        application_id: item.applicationId,
        starts_at: WorkWindow.toTimestampTz(date, item.startTime),
        ends_at: WorkWindow.toTimestampTz(endDate, item.endTime),
        is_active: true,
        inherits_on_reopen: item.inheritsOnReopen ?? false,
        affinity_weight: item.affinityWeight ?? null,
      }
      return new WorkWindow(raw)
    })
    const placeholderIds = new Set(placeholders.map(p => p.id))
    windows.value = [...windows.value, ...placeholders]
    _invalidateCache()

    try {
      const created = await createWorkWindowUseCase(data)
      windows.value = [
        ...windows.value.filter(w => !placeholderIds.has(w.id)),
        ...created,
      ]
      _invalidateCache()

      // Undo = delete the created windows
      const createdIds = created.map(w => w.id)
      _pushUndo(snapshot, async () => {
        await Promise.all(createdIds.map(id => deleteWorkWindowUseCase(id)))
      })

      return created
    } catch (e) {
      windows.value = windows.value.filter(w => !placeholderIds.has(w.id))
      _invalidateCache()
      throw e
    }
  }

  async function deleteWindow(id) {
    if (_isPlaceholder(id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    const original = _findOriginal(id)
    if (original?.isSealed) {
      throw { userMessage: 'No se pueden eliminar ventanas selladas.' }
    }
    const snapshot = [...windows.value]

    // Optimistic
    windows.value = windows.value.filter(w => w.id !== id)
    _invalidateCache()

    try {
      await deleteWorkWindowUseCase(id)
      // Undo = recreate the window
      if (original) {
        _pushUndo(snapshot, async () => {
          await createWorkWindowUseCase([_windowToCreateData(original)])
        })
      }
    } catch (e) {
      windows.value = snapshot
      _invalidateCache()
      throw e
    }
  }

  async function toggleWindow(w) {
    if (_isPlaceholder(w.id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    try {
      const updated = await toggleWorkWindowUseCase(w)
      _replaceWindow(w.id, updated)
      // Undo = toggle again
      _pushUndo(snapshot, async () => {
        await WorkWindowRepository.toggleWindows([w.id])
      })
      return updated
    } catch (e) {
      throw e
    }
  }

  async function disinheritWindow(w) {
    if (_isPlaceholder(w.id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    const results = await disinheritWorkWindowUseCase([w.id])
    const result = results[0]
    if (!result?.success) {
      throw { userMessage: _translateMessage(result?.message) || 'No se pudo desactivar la herencia.' }
    }
    // Fetch fresh window from backend
    const fresh = await WorkWindowRepository.fetchById(w.id)
    _replaceWindow(w.id, fresh)
    return fresh
  }

  /**
   * Activates inheritance on a future window via batch endpoint.
   * The DB auto-resolves inherited_from_window_id.
   */
  async function reinheritWindow(w) {
    if (_isPlaceholder(w.id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    const results = await inheritWorkWindowUseCase([w.id])
    const result = results[0]
    if (!result?.success) {
      throw { userMessage: _translateMessage(result?.message) || 'No se pudo activar la herencia.' }
    }
    const fresh = await WorkWindowRepository.fetchById(w.id)
    _replaceWindow(w.id, fresh)
    return fresh
  }

  async function horizontalExpand(w, direction, dates) {
    const now = new Date()
    for (const date of dates) {
      const windowStart = new Date(`${date}T${w.startTime}:00`)
      if (windowStart <= now) {
        throw { userMessage: 'No se pueden crear ventanas en horarios pasados.' }
      }
      const conflict = _checkOverlap(w.specialistId, date, w.startTime, w.endTime, [], w.applicationId)
      if (conflict) {
        throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
      }
    }

    const snapshot = [...windows.value]
    const windowsData = dates.map(date => ({
      specialistId: w.specialistId,
      applicationId: w.applicationId,
      startTime: w.startTime,
      endTime: w.endTime,
      scheduledDate: date,
      inheritsOnReopen: true,
    }))

    const created = await createWorkWindowUseCase(windowsData)
    _addWindows(created)

    if (direction === 'left' && !w.inheritsOnReopen) {
      if (w.hasStarted) {
        throw { userMessage: 'No se puede activar herencia en una ventana que ya inició.' }
      }
      const updated = await updateWorkWindowUseCase(w, { inheritsOnReopen: true })
      _replaceWindow(w.id, updated)
    }

    _invalidateCache()

    const createdIds = created.map(c => c.id)
    _pushUndo(snapshot, async () => {
      await Promise.all(createdIds.map(id => deleteWorkWindowUseCase(id)))
      if (direction === 'left') {
        await updateWorkWindowUseCase(w, { inheritsOnReopen: false })
      }
    })

    return created
  }

  async function deleteGroup(group) {
    if (group.windows.some(gw => _isPlaceholder(gw.id))) {
      throw { userMessage: 'Algunas ventanas aún se están creando, intenta de nuevo.' }
    }
    const snapshot = [...windows.value]
    const originals = group.windows.map(w => _findOriginal(w.id)).filter(Boolean)

    // Optimistic
    const ids = new Set(group.windows.map(w => w.id))
    windows.value = windows.value.filter(w => !ids.has(w.id))
    _invalidateCache()

    try {
      await Promise.all(group.windows.map(w => deleteWorkWindowUseCase(w.id)))
      // Undo = recreate all
      _pushUndo(snapshot, async () => {
        for (const w of originals) {
          await createWorkWindowUseCase([_windowToCreateData(w)])
        }
      })
    } catch (e) {
      windows.value = snapshot
      _invalidateCache()
      throw e
    }
  }

  async function batchDelete(ids) {
    ids = ids.filter(id => !_isPlaceholder(id))
    if (ids.length === 0) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    const originals = ids.map(id => _findOriginal(id)).filter(Boolean)

    // Optimistic — remove from current view AND all cached weeks
    const deleteSet = new Set(ids)
    windows.value = windows.value.filter(w => !deleteSet.has(w.id))
    _purgeFromAllCaches(deleteSet)
    _invalidateCache()

    try {
      await Promise.all(ids.map(id => deleteWorkWindowUseCase(id)))
      // Undo = recreate all
      _pushUndo(snapshot, async () => {
        for (const w of originals) {
          await createWorkWindowUseCase([_windowToCreateData(w)])
        }
      })
    } catch (e) {
      _invalidateCache()
      await loadWindows()
      throw e
    }
  }

  async function batchReschedule(ids, deltaDays, deltaHours) {
    ids = ids.filter(id => !_isPlaceholder(id))
    if (ids.length === 0) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    const originals = new Map()
    const optimisticMap = new Map()
    const batchIds = new Set(ids)
    const deltaMs = (deltaDays * 24 * 60 + deltaHours * 60) * 60 * 1000

    for (const id of ids) {
      const orig = _findOriginal(id)
      if (!orig) continue
      if (_isEnded(orig)) throw { userMessage: 'No se pueden mover ventanas finalizadas.' }
      if (orig.isInShift) {
        throw { userMessage: 'No se puede mover una ventana en turno activo.' }
      }
      originals.set(id, orig)
      const raw = orig._toRaw()
      raw.starts_at = _dateToTimestampTz(new Date(new Date(orig.startsAt).getTime() + deltaMs))
      raw.ends_at = _dateToTimestampTz(new Date(new Date(orig.endsAt).getTime() + deltaMs))
      optimisticMap.set(id, new WorkWindow(raw))
    }

    // Validar overlap e inheritance contra ventanas externas al batch
    for (const [id, orig] of originals.entries()) {
      const opt = optimisticMap.get(id)
      const conflict = _checkOverlapAbs(orig.specialistId, opt.startsAt, opt.endsAt, batchIds, orig.applicationId)
      if (conflict) {
        throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
      }
      const inheritErr = _checkInheritance(orig.id, opt.scheduledDate, opt.startTime, opt.endTime)
      if (inheritErr) throw { userMessage: inheritErr }
    }

    windows.value = windows.value.map(w => optimisticMap.get(w.id) || w)
    _invalidateCache()

    try {
      const items = [...originals.entries()].map(([id, orig]) => {
        const opt = optimisticMap.get(id)
        return {
          window: orig,
          data: {
            startTime: opt.startTime,
            endTime: opt.endTime,
            targetDate: opt.scheduledDate,
            endDate: opt.endDate,
          },
        }
      })
      await batchUpdateWorkWindowsUseCase(items)
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(orig => ({
          window: orig,
          data: { startTime: orig.startTime, endTime: orig.endTime, targetDate: orig.scheduledDate, endDate: orig.endDate },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      windows.value = windows.value.map(w => originals.get(w.id) || w)
      _invalidateCache()
      throw e
    }
  }

  async function batchResize(ids, direction, deltaSlots) {
    ids = ids.filter(id => !_isPlaceholder(id))
    if (ids.length === 0) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    const originals = new Map()
    const optimisticMap = new Map()
    const batchIds = new Set(ids)
    const deltaMs = deltaSlots * 30 * 60 * 1000 // each slot = 30 min

    for (const id of ids) {
      const orig = _findOriginal(id)
      if (!orig) continue
      if (_isEnded(orig)) throw { userMessage: 'No se pueden modificar ventanas finalizadas.' }
      if (direction === 'top' && orig.isInShift) {
        throw { userMessage: 'No se puede cambiar el inicio de una ventana en turno activo. Solo se permite ajustar el fin.' }
      }
      originals.set(id, orig)
      const shifted = _applyDeltaMs(orig, direction, deltaMs)
      optimisticMap.set(id, shifted.optimistic)
    }

    // Validate overlap & inheritance
    for (const [id, orig] of originals.entries()) {
      const opt = optimisticMap.get(id)
      const conflict = _checkOverlapAbs(orig.specialistId, opt.startsAt, opt.endsAt, batchIds, orig.applicationId)
      if (conflict) {
        throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
      }
      const inheritErr = _checkInheritance(id, opt.scheduledDate, opt.startTime, opt.endTime)
      if (inheritErr) throw { userMessage: inheritErr }
    }

    windows.value = windows.value.map(w => optimisticMap.get(w.id) || w)
    _invalidateCache()

    try {
      const items = [...originals.entries()].map(([id, orig]) => {
        const opt = optimisticMap.get(id)
        return {
          window: orig,
          data: {
            ...(direction === 'top' ? { startTime: opt.startTime, targetDate: opt.scheduledDate } : {}),
            ...(direction === 'bottom' ? { endTime: opt.endTime, endDate: opt.endDate } : {}),
          },
        }
      })
      await batchUpdateWorkWindowsUseCase(items)
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(orig => ({
          window: orig,
          data: { startTime: orig.startTime, endTime: orig.endTime, targetDate: orig.scheduledDate, endDate: orig.endDate },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      windows.value = windows.value.map(w => originals.get(w.id) || w)
      _invalidateCache()
      throw e
    }
  }

  async function batchToggle(ids) {
    ids = [...ids].filter(id => !_isPlaceholder(id))
    if (ids.length === 0) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    const results = await WorkWindowRepository.toggleWindows(ids)
    for (const r of results) {
      const orig = _findOriginal(r.id)
      if (orig) _replaceWindow(r.id, orig.withToggled(r.is_active))
    }
    // Undo = toggle again
    _pushUndo(snapshot, async () => {
      await WorkWindowRepository.toggleWindows([...ids])
    })
    return results
  }

  async function batchInherit(ids) {
    ids = ids.filter(id => !_isPlaceholder(id))
    if (ids.length === 0) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    const results = await inheritWorkWindowUseCase(ids)
    const failed = results.filter(r => !r.success)
    if (failed.length === results.length) {
      throw { userMessage: _translateMessage(failed[0]?.message) || 'No se pudo activar la herencia.' }
    }
    // Refresh affected windows from backend
    const successIds = results.filter(r => r.success).map(r => r.id)
    for (const id of successIds) {
      const fresh = await WorkWindowRepository.fetchById(id)
      _replaceWindow(id, fresh)
    }
    _pushUndo(snapshot, async () => {
      await disinheritWorkWindowUseCase(successIds)
    })
    return { successCount: successIds.length, failedCount: failed.length }
  }

  async function batchDisinherit(ids) {
    ids = ids.filter(id => !_isPlaceholder(id))
    if (ids.length === 0) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    const results = await disinheritWorkWindowUseCase(ids)
    const failed = results.filter(r => !r.success)
    if (failed.length === results.length) {
      throw { userMessage: _translateMessage(failed[0]?.message) || 'No se pudo desactivar la herencia.' }
    }
    // Refresh affected windows from backend
    const successIds = results.filter(r => r.success).map(r => r.id)
    for (const id of successIds) {
      const fresh = await WorkWindowRepository.fetchById(id)
      _replaceWindow(id, fresh)
    }
    _pushUndo(snapshot, async () => {
      await inheritWorkWindowUseCase(successIds)
    })
    return { successCount: successIds.length, failedCount: failed.length }
  }

  async function batchMerge(ids) {
    const realIds = [...ids].filter(id => !_isPlaceholder(id))
    if (realIds.length < 2) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    const snapshot = [...windows.value]
    const result = await mergeWorkWindowsUseCase(realIds)

    // Remove deleted windows (homogeneous merge)
    if (result.deletedIds.length) {
      const deleteSet = new Set(result.deletedIds)
      windows.value = windows.value.filter(w => !deleteSet.has(w.id))
      _purgeFromAllCaches(deleteSet)
    }

    // Update surviving/synced windows
    for (const updated of result.windows) {
      _replaceWindow(updated.id, updated)
    }

    _invalidateCache()

    // Undo is not feasible (merge may delete windows server-side), reload instead
    _pushUndo(snapshot, async () => { await loadWindows() })

    return result
  }

  async function eraseRange(dates, eraseStartTime, eraseEndTime) {
    // Accept single date (string) or array of dates
    const dateList = Array.isArray(dates) ? dates : [dates]
    const snapshot = [...windows.value]

    const now = new Date()
    const eraseS = _timeToMinutes(eraseStartTime)
    const eraseE = _timeToMinutes(eraseEndTime)

    // Classify affected windows across all dates
    const allDeletes = []
    const allUpdates = []
    const allSplits = []

    for (const date of dateList) {
      const onDate = windows.value.filter(w => w.scheduledDate === date)
      for (const w of onDate) {
        if (_isEnded(w)) continue  // skip ended windows — both timestamps sealed
        const wS = _timeToMinutes(w.startTime)
        const wE = _timeToMinutes(w.endTime)
        if (eraseE <= wS || eraseS >= wE) continue
        if (eraseS <= wS && eraseE >= wE) {
          allDeletes.push(w)
        } else if (eraseS <= wS) {
          // This would push starts_at forward — blocked for in-shift windows
          if (w.isInShift) continue
          allUpdates.push({ window: w, startTime: eraseEndTime, date })
        } else if (eraseE >= wE) {
          allUpdates.push({ window: w, endTime: eraseStartTime, date })
        } else {
          allSplits.push({ window: w, cutStart: eraseStartTime, cutEnd: eraseEndTime, date })
        }
      }
    }

    if (allDeletes.length === 0 && allUpdates.length === 0 && allSplits.length === 0) return

    // 1) Optimistic: batch ALL changes into a single windows.value assignment
    const deleteIds = new Set(allDeletes.map(w => w.id))
    const updateMap = new Map()
    const newWindows = []

    for (const op of allUpdates) {
      updateMap.set(op.window.id, _buildOptimistic(op.window, {
        startTime: op.startTime || undefined,
        endTime: op.endTime || undefined,
      }))
    }
    for (const op of allSplits) {
      updateMap.set(op.window.id, _buildOptimistic(op.window, { endTime: op.cutStart }))
      const raw = op.window._toRaw()
      raw.id = '__split_' + op.window.id
      raw.starts_at = WorkWindow.toTimestampTz(op.date, op.cutEnd)
      raw.ends_at = WorkWindow.toTimestampTz(op.date, op.window.endTime)
      raw.inherits_on_reopen = true
      newWindows.push(new WorkWindow(raw))
    }

    windows.value = [
      ...windows.value.filter(w => !deleteIds.has(w.id)).map(w => updateMap.get(w.id) || w),
      ...newWindows,
    ]
    _invalidateCache()

    // 2) Backend: deletes & updates in parallel, then creates sequentially
    const splitCreatedIds = []
    try {
      const deletePromises = allDeletes.map(w => deleteWorkWindowUseCase(w.id))

      // Batch all updates + split trims in one PATCH
      const updateItems = [
        ...allUpdates.map(op => ({
          window: op.window,
          data: {
            ...(op.startTime ? { startTime: op.startTime } : {}),
            ...(op.endTime ? { endTime: op.endTime } : {}),
          },
        })),
        ...allSplits.map(op => ({
          window: op.window,
          data: { endTime: op.cutStart },
        })),
      ]

      const batchPromise = updateItems.length > 0
        ? batchUpdateWorkWindowsUseCase(updateItems)
        : Promise.resolve()

      await Promise.all([...deletePromises, batchPromise])

      for (const op of allSplits) {
        const splitId = '__split_' + op.window.id
        const newWin = [{
          specialistId: op.window.specialistId,
          applicationId: op.window.applicationId,
          startTime: op.cutEnd,
          endTime: op.window.endTime,
          scheduledDate: op.date,
          inheritsOnReopen: true,
        }]
        const created = await createWorkWindowUseCase(newWin)
        splitCreatedIds.push(...created.map(c => c.id))
        windows.value = [
          ...windows.value.filter(w => w.id !== splitId),
          ...created,
        ]
        _invalidateCache()
      }

      // Undo = delete splits, restore updates, recreate deletes
      _pushUndo(snapshot, async () => {
        if (splitCreatedIds.length > 0) {
          await Promise.all(splitCreatedIds.map(id => deleteWorkWindowUseCase(id)))
        }
        const restoreItems = [
          ...allUpdates.map(op => ({
            window: op.window,
            data: { startTime: op.window.startTime, endTime: op.window.endTime },
          })),
          ...allSplits.map(op => ({
            window: op.window,
            data: { endTime: op.window.endTime },
          })),
        ]
        if (restoreItems.length > 0) await batchUpdateWorkWindowsUseCase(restoreItems)
        for (const w of allDeletes) {
          await createWorkWindowUseCase([_windowToCreateData(w)])
        }
      })
    } catch (e) {
      _invalidateCache()
      await loadWindows()
      throw e
    }
  }

  async function updateWindow(w, payload) {
    if (_isPlaceholder(w.id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    if (_isEnded(w)) throw { userMessage: 'No se puede modificar una ventana finalizada.' }
    const snapshot = [...windows.value]
    const updated = await updateWorkWindowUseCase(w, payload)
    if (payload.targetDate && payload.targetDate !== w.scheduledDate) {
      _removeWindow(w.id)
      _addWindows([updated])
      _invalidateCache()
    } else {
      _replaceWindow(w.id, updated)
    }
    // Undo = update back to original values
    _pushUndo(snapshot, async () => {
      const undoPayload = { startTime: w.startTime, endTime: w.endTime }
      if (payload.targetDate) undoPayload.targetDate = w.scheduledDate
      await updateWorkWindowUseCase(w, undoPayload)
    })
    return updated
  }

  async function resizeWindow({ window: w, startTime, endTime }) {
    if (_isPlaceholder(w.id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    const original = _findOriginal(w.id)
    if (!original) return
    if (_isEnded(original)) throw { userMessage: 'No se puede modificar una ventana finalizada.' }
    if (startTime && original.isInShift) {
      throw { userMessage: 'No se puede cambiar el inicio de una ventana en turno activo. Solo se permite ajustar el fin.' }
    }
    const st = startTime || original.startTime
    const et = endTime || original.endTime
    const conflict = _checkOverlap(original.specialistId, original.scheduledDate, st, et, [w.id], original.applicationId)
    if (conflict) {
      throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
    }
    const inheritErr = _checkInheritance(w.id, original.scheduledDate, st, et)
    if (inheritErr) throw { userMessage: inheritErr }
    const snapshot = [...windows.value]
    const optimistic = _buildOptimistic(original, { startTime, endTime })
    _replaceWindow(w.id, optimistic)
    try {
      await updateWorkWindowUseCase(original, { startTime, endTime })
      // Undo = resize back
      _pushUndo(snapshot, async () => {
        await updateWorkWindowUseCase(original, {
          startTime: original.startTime,
          endTime: original.endTime,
        })
      })
    } catch (e) {
      _replaceWindow(w.id, original)
      throw e
    }
  }

  async function resizeGroup({ group, startTime, endTime }) {
    if (group.windows.some(gw => _isPlaceholder(gw.id))) {
      throw { userMessage: 'Algunas ventanas aún se están creando, intenta de nuevo.' }
    }
    const snapshot = [...windows.value]
    const originals = new Map()
    const optimisticMap = new Map()
    const groupIds = new Set(group.windows.map(gw => gw.id))

    for (const gw of group.windows) {
      const orig = _findOriginal(gw.id)
      if (!orig) continue
      if (_isEnded(orig)) throw { userMessage: 'No se puede modificar un grupo con ventanas finalizadas.' }
      if (startTime && orig.isInShift) {
        throw { userMessage: 'No se puede cambiar el inicio de una ventana en turno activo. Solo se permite ajustar el fin.' }
      }
      originals.set(gw.id, orig)
      optimisticMap.set(gw.id, _buildOptimistic(orig, { startTime, endTime }))
    }

    // Validar overlap e inheritance contra ventanas externas al grupo
    for (const orig of originals.values()) {
      const st = startTime || orig.startTime
      const et = endTime || orig.endTime
      const conflict = _checkOverlap(orig.specialistId, orig.scheduledDate, st, et, groupIds, orig.applicationId)
      if (conflict) {
        throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
      }
      const inheritErr = _checkInheritance(orig.id, orig.scheduledDate, st, et)
      if (inheritErr) throw { userMessage: inheritErr }
    }

    windows.value = windows.value.map(w => optimisticMap.get(w.id) || w)
    _invalidateCache()

    try {
      const items = [...originals.values()].map(w => ({
        window: w,
        data: { startTime, endTime },
      }))
      await batchUpdateWorkWindowsUseCase(items)
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(w => ({
          window: w,
          data: { startTime: w.startTime, endTime: w.endTime },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      windows.value = windows.value.map(w => originals.get(w.id) || w)
      _invalidateCache()
      throw e
    }
  }

  async function rescheduleWindow({ window: w, targetDate, startTime, endTime }) {
    if (_isPlaceholder(w.id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    const original = _findOriginal(w.id)
    if (!original) return
    if (_isEnded(original)) throw { userMessage: 'No se puede mover una ventana finalizada.' }
    if (original.isInShift) {
      throw { userMessage: 'No se puede mover una ventana en turno activo.' }
    }
    const date = targetDate || original.scheduledDate
    const conflict = _checkOverlap(original.specialistId, date, startTime, endTime, [w.id], original.applicationId)
    if (conflict) {
      throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
    }
    const inheritErr = _checkInheritance(w.id, date, startTime, endTime)
    if (inheritErr) throw { userMessage: inheritErr }
    const snapshot = [...windows.value]
    const optimistic = _buildOptimistic(original, { startTime, endTime, targetDate })
    _replaceWindow(w.id, optimistic)
    try {
      await rescheduleWorkWindowUseCase(original, { startTime, endTime, targetDate })
      // Undo = reschedule back
      _pushUndo(snapshot, async () => {
        await rescheduleWorkWindowUseCase(
          { id: original.id, scheduledDate: targetDate },
          { startTime: original.startTime, endTime: original.endTime, targetDate: original.scheduledDate }
        )
      })
    } catch (e) {
      _replaceWindow(w.id, original)
      throw e
    }
  }

  async function rescheduleGroup({ group, targetDate, deltaHours }) {
    if (group.windows.some(gw => _isPlaceholder(gw.id))) {
      throw { userMessage: 'Algunas ventanas aún se están creando, intenta de nuevo.' }
    }
    const snapshot = [...windows.value]
    const originals = new Map()
    const optimisticMap = new Map()
    const groupIds = new Set(group.windows.map(gw => gw.id))
    // Compute delta from group's first window to determine the day shift
    const refOrig = _findOriginal(group.windows[0]?.id)
    const deltaDays = refOrig ? _daysBetween(refOrig.scheduledDate, targetDate) : 0
    const deltaMs = (deltaDays * 24 * 60 + deltaHours * 60) * 60 * 1000

    for (const gw of group.windows) {
      const orig = _findOriginal(gw.id)
      if (!orig) continue
      if (_isEnded(orig)) throw { userMessage: 'No se puede mover un grupo con ventanas finalizadas.' }
      if (orig.isInShift) {
        throw { userMessage: 'No se puede mover una ventana en turno activo.' }
      }
      originals.set(gw.id, orig)
      const raw = orig._toRaw()
      raw.starts_at = _dateToTimestampTz(new Date(new Date(orig.startsAt).getTime() + deltaMs))
      raw.ends_at = _dateToTimestampTz(new Date(new Date(orig.endsAt).getTime() + deltaMs))
      optimisticMap.set(gw.id, new WorkWindow(raw))
    }

    // Validar overlap e inheritance contra ventanas externas al grupo
    for (const [id, orig] of originals.entries()) {
      const opt = optimisticMap.get(id)
      const conflict = _checkOverlapAbs(orig.specialistId, opt.startsAt, opt.endsAt, groupIds, orig.applicationId)
      if (conflict) {
        throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
      }
      const inheritErr = _checkInheritance(orig.id, opt.scheduledDate, opt.startTime, opt.endTime)
      if (inheritErr) throw { userMessage: inheritErr }
    }

    windows.value = windows.value.map(w => optimisticMap.get(w.id) || w)
    _invalidateCache()

    try {
      const items = [...originals.entries()].map(([id, orig]) => {
        const opt = optimisticMap.get(id)
        return {
          window: orig,
          data: {
            startTime: opt.startTime,
            endTime: opt.endTime,
            targetDate: opt.scheduledDate,
            endDate: opt.endDate,
          },
        }
      })
      await batchUpdateWorkWindowsUseCase(items)
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(orig => ({
          window: orig,
          data: { startTime: orig.startTime, endTime: orig.endTime, targetDate: orig.scheduledDate, endDate: orig.endDate },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      windows.value = windows.value.map(w => originals.get(w.id) || w)
      _invalidateCache()
      throw e
    }
  }

  async function addWindowToSlot(data) {
    return (await createWindows([data]))[0]
  }

  // ---- Navigation ----
  function prevNav() {
    if (calView.value === 'day') dayOffset.value--
    else if (calView.value === 'month') monthOffset.value--
    else weekOffset.value--
  }

  function nextNav() {
    if (calView.value === 'day') dayOffset.value++
    else if (calView.value === 'month') monthOffset.value++
    else weekOffset.value++
  }

  function goToday() {
    if (calView.value === 'day') dayOffset.value = 0
    else if (calView.value === 'month') monthOffset.value = 0
    else weekOffset.value = 0
  }

  function selectDay(dateStr) {
    const target = new Date(dateStr + 'T12:00:00')
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    dayOffset.value = Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    _skipViewSync = true
    calView.value = 'day'
  }

  function goToDate(dateStr) {
    const target = new Date(dateStr + 'T12:00:00')
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    if (calView.value === 'day') {
      dayOffset.value = Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    } else if (calView.value === 'month') {
      monthOffset.value = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
    } else {
      const diffMs = target.getTime() - now.getTime()
      weekOffset.value = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    }
  }

  function nextDay() { dayOffset.value++ }
  function prevDay() { dayOffset.value-- }

  function updateMobile(val) { isMobile.value = val }

  // ---- Realtime handlers ----
  function onWindowCreatedRT(data) {
    const items = Array.isArray(data) ? data : [data]
    const newWindows = items.map(d => new WorkWindow(d))
    _addWindows(newWindows)
  }

  function onWindowUpdatedRT(data) {
    const updated = new WorkWindow(data)
    _replaceWindow(updated.id, updated)
  }

  function onWindowDeletedRT(data) {
    const id = typeof data === 'string' ? data : data.id
    _removeWindow(id)
  }

  function onWindowToggledRT(data) {
    const updated = new WorkWindow(data)
    _replaceWindow(updated.id, updated)
  }

  function onWindowMergedRT(data) {
    // data: { mode, deleted_ids: [...], windows: [<raw window>, ...] }
    if (data.deleted_ids) {
      for (const id of data.deleted_ids) _removeWindow(id)
    }
    const items = data.windows || []
    for (const raw of items) {
      const ww = new WorkWindow(raw)
      const exists = windows.value.some(w => w.id === ww.id)
      if (exists) _replaceWindow(ww.id, ww)
      else _addWindows([ww])
    }
  }

  function onWindowBatchRT(data) {
    // Bulk update: reload the full range
    loadWindows()
  }

  // ---- Helpers ----
  function findSpec(id) {
    const userStore = useUserStore()
    return userStore.users.find(u => u.specialistId === id)
  }

  function findApp(id) {
    const userStore = useUserStore()
    return userStore.applications.find(a => a.id === id)
  }

  function specName(w) { return findSpec(w.specialistId)?.fullName || w.specialistId }
  function appName(w) { return findApp(w.applicationId)?.name || w.applicationId }

  return {
    // Navigation
    calView,
    weekOffset,
    dayOffset,
    monthOffset,
    prevNav,
    nextNav,
    goToday,
    selectDay,
    goToDate,
    nextDay,
    prevDay,

    // Dates
    weekDates,
    monthDates,
    currentMonth,
    weekLabel,

    // Windows
    windows,
    loading,
    windowsFiltradas,
    loadWindows,

    // Undo
    canUndo,
    undo,

    // Filters
    filtroSpecialist,
    filtroApp,
    specOptions,
    appOptions,
    specialistsConVentana,

    // CRUD
    createWindows,
    deleteWindow,
    deleteGroup,
    toggleWindow,
    disinheritWindow,
    reinheritWindow,
    horizontalExpand,
    batchDelete,
    batchReschedule,
    batchResize,
    batchToggle,
    batchInherit,
    batchDisinherit,
    batchMerge,
    eraseRange,
    updateWindow,
    resizeWindow,
    resizeGroup,
    rescheduleWindow,
    rescheduleGroup,
    addWindowToSlot,

    // Helpers
    findSpec,
    findApp,
    specName,
    appName,
    isMobile,
    updateMobile,
    density,
    setDensity,

    // Realtime
    onWindowCreatedRT,
    onWindowUpdatedRT,
    onWindowDeletedRT,
    onWindowToggledRT,
    onWindowMergedRT,
    onWindowBatchRT,
  }
})

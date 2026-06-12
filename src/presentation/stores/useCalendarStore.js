import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { fetchWorkWindowsUseCase } from '@/application/use-cases/work-windows/FetchWorkWindowsUseCase'
import { createWorkWindowUseCase } from '@/application/use-cases/work-windows/CreateWorkWindowUseCase'
import { createRecurringWorkWindowsUseCase } from '@/application/use-cases/work-windows/CreateRecurringWorkWindowsUseCase'
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

// ---- Pure date helpers (parametrized by offset) — shared by the store
// computeds and by useCalendarPages (3-page buffer). ----
export function weekDatesForOffset(offset) {
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return fmtDateISO(d)
  })
}

export function dayDateForOffset(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function monthDatesForOffset(offset) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const day = first.getDay()
  const toMonday = day === 0 ? -6 : 1 - day
  const start = new Date(first)
  start.setDate(first.getDate() + toMonday)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return fmtDateISO(d)
  })
}

export function monthNumForOffset(offset) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).getMonth()
}

export const useCalendarStore = defineStore('calendar', () => {
  // ---- Navigation ----
  const CAL_VIEW_KEY = 'tyflow_cal_view'
  const _storedView = localStorage.getItem(CAL_VIEW_KEY)
  const _validViews = ['day', 'week', 'month']
  const calView = ref(
    window.innerWidth < BP_MOBILE
      ? 'day'
      : (_validViews.includes(_storedView) ? _storedView : 'week')
  )
  watch(calView, (val) => {
    if (_validViews.includes(val)) localStorage.setItem(CAL_VIEW_KEY, val)
  })
  const weekOffset = ref(0)
  const dayOffset = ref(0)
  const monthOffset = ref(0)

  // ---- SyncEngine (USO PARCIAL / AISLADO en el calendario) ----
  //
  // El SyncEngine (infrastructure/sync/SyncEngine.js) es un motor genérico
  // cache-first con CRDT Last-Write-Wins. Otros stores (users, applications,
  // cases) lo usan COMPLETO: `syncInBackground()` hace fetch + merge + persist.
  //
  // El calendario lo usa SOLO para HIDRATAR desde caché al arrancar
  // (`loadFromCache()` abajo). NO usa su ciclo de sync porque las ventanas se
  // piden por RANGO de fechas (estrategia acumulativa, ver `_fetchRange` /
  // `loadWindows`), no como un dataset completo — por eso `fetchRemote` va vacío.
  // La reconciliación CRDT (LWW) se reimplementa en `_mergeWindows` con la misma
  // semántica del engine (ventana reciente protegida → ver _RECENT_WINDOW_MS).
  const _sync = new SyncEngine({
    cacheKey: 'tyflow_work_windows',
    hydrate: (raw) => new WorkWindow(raw),
    fetchRemote: () => Promise.resolve([]),   // no se usa: el fetch es por rango
    getId: (item) => item.id,
  })

  // ---- Windows ----
  const windows = ref(_sync.loadFromCache())
  const loading = ref(false)

  // Ventana de tiempo (ms) en la que un cambio local reciente GANA sobre el
  // backend en el merge (CRDT Last-Write-Wins). Cubre el lapso entre la mutación
  // optimista y que el backend la refleje.
  const _RECENT_WINDOW_MS = 30_000

  // ---- Tombstones CRDT (borrados recientes) ----
  // El LWW protege ventanas MODIFICADAS hace poco, pero un borrado las saca de
  // windows.value y pierden esa protección: un fetch que ya estaba en vuelo
  // (prefetch de vecinos, recarga por evento batch) resuelve con datos previos
  // al DELETE y _mergeWindows las "resucitaba". El tombstone recuerda el id
  // borrado durante _RECENT_WINDOW_MS y bloquea su reaparición por fetch o RT.
  const _recentDeletes = new Map()   // id -> epoch ms
  function _markDeleted(ids) {
    const t = Date.now()
    for (const id of ids) _recentDeletes.set(id, t)
  }
  function _unmarkDeleted(ids) {
    for (const id of ids) _recentDeletes.delete(id)
  }
  function _isRecentlyDeleted(id) {
    const t = _recentDeletes.get(id)
    if (!t) return false
    if (Date.now() - t > _RECENT_WINDOW_MS) { _recentDeletes.delete(id); return false }
    return true
  }

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

  // ---- Filters (multi-select, modelo de EXCLUSIÓN) ----
  // Se guardan los OCULTOS: default vacío = todo visible, y especialistas/apps
  // nuevos quedan visibles sin tocar el filtro guardado.
  const HIDDEN_SPECS_KEY = 'tyflow_cal_hidden_specs'
  const HIDDEN_APPS_KEY = 'tyflow_cal_hidden_apps'
  const SHOW_ACTIVE_KEY = 'tyflow_cal_show_active'
  const SHOW_INACTIVE_KEY = 'tyflow_cal_show_inactive'

  function _loadHidden(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) }
    catch { return new Set() }
  }

  const hiddenSpecs = ref(_loadHidden(HIDDEN_SPECS_KEY))
  const hiddenApps = ref(_loadHidden(HIDDEN_APPS_KEY))
  const showActive = ref(localStorage.getItem(SHOW_ACTIVE_KEY) !== 'false')
  const showInactive = ref(localStorage.getItem(SHOW_INACTIVE_KEY) !== 'false')

  function _persistHidden(key, set) {
    localStorage.setItem(key, JSON.stringify([...set]))
  }

  function toggleSpecFilter(id) {
    const next = new Set(hiddenSpecs.value)
    next.has(id) ? next.delete(id) : next.add(id)
    hiddenSpecs.value = next
    _persistHidden(HIDDEN_SPECS_KEY, next)
  }

  function toggleAppFilter(id) {
    const next = new Set(hiddenApps.value)
    next.has(id) ? next.delete(id) : next.add(id)
    hiddenApps.value = next
    _persistHidden(HIDDEN_APPS_KEY, next)
  }

  // visible=true → mostrar todos (vaciar ocultos); false → ocultar todos los ids dados
  function setAllSpecs(visible, allIds = []) {
    const next = visible ? new Set() : new Set(allIds)
    hiddenSpecs.value = next
    _persistHidden(HIDDEN_SPECS_KEY, next)
  }

  function setAllApps(visible, allIds = []) {
    const next = visible ? new Set() : new Set(allIds)
    hiddenApps.value = next
    _persistHidden(HIDDEN_APPS_KEY, next)
  }

  function toggleShowActive() {
    showActive.value = !showActive.value
    localStorage.setItem(SHOW_ACTIVE_KEY, String(showActive.value))
  }

  function toggleShowInactive() {
    showInactive.value = !showInactive.value
    localStorage.setItem(SHOW_INACTIVE_KEY, String(showInactive.value))
  }

  // ---- Seam Crear (CalSidebar se publica en el board del sidebar vía
  // Teleport; el ref del store evita acoplar el flujo a la jerarquía DOM) ----
  const createRequest = ref(null)   // { mode: 'single'|'bulk', ts }
  function requestCreate(mode) { createRequest.value = { mode, ts: Date.now() } }

  // ---- Computed dates ----
  const weekDates = computed(() => {
    if (calView.value === 'month') {
      return monthDates.value.length
        ? [monthDates.value[0], monthDates.value[monthDates.value.length - 1]]
        : []
    }
    if (calView.value === 'day') {
      return [dayDateForOffset(dayOffset.value)]
    }
    return weekDatesForOffset(weekOffset.value)
  })

  const monthDates = computed(() => {
    if (calView.value !== 'month') return []
    return monthDatesForOffset(monthOffset.value)
  })

  const currentMonth = computed(() => monthNumForOffset(monthOffset.value))

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
      if (hiddenSpecs.value.has(w.specialistId)) return false
      if (hiddenApps.value.has(w.applicationId)) return false
      if (!showActive.value && w.isActive) return false
      if (!showInactive.value && !w.isActive) return false
      return true
    })
  })

  // ---- Filter options ----
  const specialistsConVentana = computed(() => {
    const userStore = useUserStore()
    return userStore.users.filter(u => u.specialistId && u.isActive && u.specialistIsActive !== false)
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
    // Merge CRDT Last-Write-Wins: reemplaza las ventanas del rango [from,to] con
    // lo del backend, PERO si una ventana local fue modificada hace poco
    // (_localUpdatedAt reciente, p.ej. recién movida), la versión local gana.
    // Esto evita que un fetch en background (aún con la posición vieja) pise una
    // ventana recién arrastrada y la haga "saltar".
    const now = Date.now()
    const recentLocal = new Map()
    for (const w of windows.value) {
      if (w._localUpdatedAt && now - new Date(w._localUpdatedAt).getTime() < _RECENT_WINDOW_MS) {
        recentLocal.set(w.id, w)
      }
    }

    const merged = []
    const placed = new Set()
    for (const fw of fetched) {
      if (_isRecentlyDeleted(fw.id)) continue   // tombstone: borrada localmente
      const local = recentLocal.get(fw.id)
      merged.push(local || fw)   // local reciente gana sobre el backend stale
      placed.add(fw.id)
    }
    // Conservar lo de fuera de rango (estrategia acumulativa) y los locales
    // recientes que el fetch aún no trajo (movida pendiente de reflejar).
    for (const w of windows.value) {
      if (placed.has(w.id)) continue
      const inDateRange = w.scheduledDate >= fromDate && w.scheduledDate <= toDate
      if (!inDateRange) { merged.push(w); continue }
      if (recentLocal.has(w.id)) merged.push(w)
    }

    windows.value = merged
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

  // Seam INTENCIONAL (no-op). Marca los puntos donde, en la estrategia
  // acumulativa por rango, *podría* persistirse la caché de ventanas. Hoy no se
  // persiste a propósito: el estado vive en `windows.value` (reactivo) y la
  // verdad la trae el fetch por rango + `_mergeWindows`. Se conserva como punto
  // único de cambio por si se decide activar `_sync.writeToCache(windows.value)`.
  function _invalidateCache() {
    // (no-op deliberado — ver comentario arriba)
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

  // Cola de mutaciones POR VENTANA: si el usuario mueve/redimensiona la misma
  // ventana varias veces seguidas, los PATCH se serializan en orden. Sin esto,
  // dos PATCH en vuelo pueden llegar al backend desordenados y el estado final
  // queda en la posición del arrastre N-1 → "brinco" al refrescar.
  const _mutationChains = new Map()
  function _enqueueMutation(id, fn) {
    const prev = _mutationChains.get(id) || Promise.resolve()
    const run = prev.catch(() => {}).then(fn)
    const tracked = run.finally(() => {
      if (_mutationChains.get(id) === tracked) _mutationChains.delete(id)
    })
    _mutationChains.set(id, tracked)
    return run
  }

  /** Variante grupal: espera las colas de TODAS las ventanas implicadas. */
  function _enqueueGroupMutation(ids, fn) {
    const prevs = [...ids].map(id => (_mutationChains.get(id) || Promise.resolve()).catch(() => {}))
    const run = Promise.all(prevs).then(fn)
    for (const id of ids) {
      const tracked = run.catch(() => {}).finally(() => {
        if (_mutationChains.get(id) === tracked) _mutationChains.delete(id)
      })
      _mutationChains.set(id, tracked)
    }
    return run
  }

  /** Rollback protegido: restaura el original SOLO donde nuestro optimista
   *  sigue vigente — un movimiento más nuevo encima no se pisa. */
  function _rollbackOptimistic(originals, optimisticMap) {
    windows.value = windows.value.map(w =>
      optimisticMap.get(w.id) === w ? (originals.get(w.id) || w) : w
    )
    _invalidateCache()
  }

  /** Procesa el resultado de un batch update: el backend responde 200 con
   *  fallos POR ÍTEM en `failed[]` — antes se ignoraban en silencio y el
   *  optimista quedaba pintado aunque el servidor lo hubiera rechazado.
   *  Revierte solo las fallidas (las exitosas se conservan) y lanza el motivo
   *  traducido. Llamar FUERA del try/catch del rollback total. */
  function _assertBatchOk(result, originals, optimisticMap) {
    const failed = result?.failed ?? []
    if (failed.length === 0) return
    for (const f of failed) {
      const orig = originals.get(f.id)
      const opt = optimisticMap.get(f.id)
      if (orig && opt && _findOriginal(f.id) === opt) _replaceWindow(f.id, orig)
    }
    _invalidateCache()
    const reason = _translateMessage(failed[0]?.reason) || 'Error del servidor.'
    const total = originals.size
    throw {
      userMessage: failed.length >= total
        ? reason
        : `${failed.length} de ${total} ventanas no se actualizaron: ${reason}`,
    }
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
    [/Cannot delete a sealed work window that has assignments/i, 'No se puede eliminar: la ventana ya inició y tiene casos asignados.'],
    [/is sealed/i, 'La ventana ya inició y no se puede modificar.'],
    [/overlaps with an existing/i, 'El horario se solapa con una ventana existente del mismo especialista y aplicación.'],
    [/already ended/i, 'La ventana ya finalizó.'],
    [/starting in the past|starts_at to a past/i, 'No se pueden crear ventanas que inician en el pasado.'],
    [/Cannot change starts_at.*in shift|starts_at.*sealed/i, 'No se puede cambiar el inicio de una ventana en turno activo. Solo se permite ajustar el fin.'],
    [/ends_at.*past|past.*ends_at/i, 'No se puede dejar el fin de la ventana en el pasado.'],
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
    return new WorkWindow(raw).withLocalUpdate()
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

  // Validación de "pasado" para mover ventanas: el inicio no puede quedar antes
  // de AHORA. Se valida en el FRONT (antes del optimista y de llamar al backend)
  // para no perder tiempo ni dejar el estado a medias si el backend rechaza.
  const _PAST_MOVE_MSG = 'No se puede mover una ventana antes de la hora actual.'
  function _startsInPast(ts) {
    return ts ? new Date(ts) < new Date() : false
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
      const startDate = item.scheduledDate || _todayISO()
      const endDate = item.endDate || item.scheduledDate || _todayISO()
      // El inicio no puede ser anterior a la línea de tiempo (now).
      const startsAt = WorkWindow.toTimestampTz(startDate, item.startTime || '00:00')
      if (startsAt && new Date(startsAt) < now) {
        throw { userMessage: 'No se puede crear una ventana que inicie en el pasado.' }
      }
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
      // withLocalUpdate: protege el placeholder de un merge stale en vuelo
      return new WorkWindow(raw).withLocalUpdate()
    })
    const placeholderIds = new Set(placeholders.map(p => p.id))
    windows.value = [...windows.value, ...placeholders]
    _invalidateCache()

    try {
      const created = (await createWorkWindowUseCase(data)).map(w => w.withLocalUpdate())
      const createdIds = new Set(created.map(w => w.id))
      windows.value = [
        ...windows.value.filter(w => !placeholderIds.has(w.id) && !createdIds.has(w.id)),
        ...created,
      ]
      _invalidateCache()

      // Undo = delete the created windows
      _pushUndo(snapshot, async () => {
        _markDeleted(createdIds)
        await Promise.all([...createdIds].map(id => deleteWorkWindowUseCase(id)))
      })

      return created
    } catch (e) {
      windows.value = windows.value.filter(w => !placeholderIds.has(w.id))
      _invalidateCache()
      throw e
    }
  }

  /**
   * Crea series RECURRENTES vía POST /work-windows/recurring (una llamada por
   * combo especialista+app). El backend encadena la herencia automáticamente
   * (1ª ocurrencia hereda solo si hay ventana previa; 2..N entre sí) y cada
   * serie es atómica. Si un combo falla, los anteriores quedan creados y el
   * error reporta el progreso.
   *
   * @param {Array<{specialistId, applicationId}>} combos
   * @param {string[]} dates  fechas YYYY-MM-DD (ya expandidas por el modal)
   * @param {string} startTime HH:MM
   * @param {string} endTime HH:MM
   * @param {number} [affinityWeight=1]
   */
  async function createRecurringWindows(combos, dates, startTime, endTime, affinityWeight = 1) {
    if (!combos.length || !dates.length) throw { userMessage: 'Nada que crear.' }
    const now = new Date()
    for (const date of dates) {
      const startsAt = WorkWindow.toTimestampTz(date, startTime)
      if (startsAt && new Date(startsAt) < now) {
        throw { userMessage: 'No se puede crear una ventana que inicie en el pasado.' }
      }
    }
    const snapshot = [...windows.value]
    const slots = dates.map(date => ({ date, startTime, endTime }))
    const allCreated = []

    // Merge con dedupe: el evento realtime window_created puede haberlas
    // añadido ya durante el await (carrera RT vs respuesta HTTP).
    function _mergeCreated(list) {
      const ids = new Set(list.map(w => w.id))
      windows.value = [...windows.value.filter(w => !ids.has(w.id)), ...list]
      _invalidateCache()
      _pushUndo(snapshot, async () => {
        _markDeleted(ids)
        await WorkWindowRepository.deleteWindows([...ids])
      })
    }

    try {
      for (const combo of combos) {
        const created = await createRecurringWorkWindowsUseCase({
          specialistId: combo.specialistId,
          applicationId: combo.applicationId,
          slots,
          affinityWeight,
        })
        // Sellar como cambio local reciente (CRDT LWW) para que un fetch en
        // background no las pise mientras el backend propaga.
        allCreated.push(...created.map(w => w.withLocalUpdate()))
      }
    } catch (e) {
      if (allCreated.length > 0) {
        // Series previas ya creadas (cada serie es atómica, el lote no)
        _mergeCreated(allCreated)
        e.userMessage = `${(e.userMessage || 'Error al crear la serie.')} (${allCreated.length} ventanas de combos anteriores sí se crearon.)`
      }
      throw e
    }
    _mergeCreated(allCreated)
    return allCreated
  }

  // Regla de borrado: una ventana SELLADA (starts_at <= now, ya inició o pasó)
  // NO se elimina — se valida en el front para cortar la acción de inmediato.
  const _SEALED_DELETE_MSG = 'No se puede eliminar una ventana que ya inició.'

  async function deleteWindow(id) {
    if (_isPlaceholder(id)) throw { userMessage: 'La ventana aún se está creando, intenta de nuevo.' }
    const original = _findOriginal(id)
    if (original?.isSealed) throw { userMessage: _SEALED_DELETE_MSG }
    const snapshot = [...windows.value]

    // Optimistic (+ tombstone: un fetch en vuelo no debe resucitarla)
    _markDeleted([id])
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
      _unmarkDeleted([id])
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
    if (originals.some(w => w.isSealed)) {
      throw { userMessage: 'El grupo contiene ventanas que ya iniciaron y no se pueden eliminar.' }
    }

    // Optimistic (+ tombstones)
    const ids = new Set(group.windows.map(w => w.id))
    _markDeleted(ids)
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
      _unmarkDeleted(ids)
      windows.value = snapshot
      _invalidateCache()
      throw e
    }
  }

  async function batchDelete(ids) {
    ids = ids.filter(id => !_isPlaceholder(id))
    if (ids.length === 0) throw { userMessage: 'Las ventanas aún se están creando, intenta de nuevo.' }
    // Selladas fuera: solo se eliminan las futuras de la selección.
    ids = ids.filter(id => !_findOriginal(id)?.isSealed)
    if (ids.length === 0) throw { userMessage: 'Las ventanas seleccionadas ya iniciaron y no se pueden eliminar.' }
    const snapshot = [...windows.value]
    const originals = ids.map(id => _findOriginal(id)).filter(Boolean)

    // Optimistic — remove from current view AND all cached weeks (+ tombstones)
    const deleteSet = new Set(ids)
    _markDeleted(deleteSet)
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
      return ids.length
    } catch (e) {
      // Borrado parcial posible (Promise.all): quitar tombstones y refetch
      // para reflejar la verdad del backend.
      _unmarkDeleted(deleteSet)
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
      if (_startsInPast(raw.starts_at)) throw { userMessage: _PAST_MOVE_MSG }
      optimisticMap.set(id, new WorkWindow(raw).withLocalUpdate())
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

    let result
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
      result = await _enqueueGroupMutation(batchIds, () => batchUpdateWorkWindowsUseCase(items))
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(orig => ({
          window: orig,
          data: { startTime: orig.startTime, endTime: orig.endTime, targetDate: orig.scheduledDate, endDate: orig.endDate },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      _rollbackOptimistic(originals, optimisticMap)
      throw e
    }
    // Fallos por ítem (200 con failed[]): revertir esas y avisar
    _assertBatchOk(result, originals, optimisticMap)
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
      optimisticMap.set(id, shifted.optimistic.withLocalUpdate())
    }

    // Validate overlap & inheritance
    for (const [id, orig] of originals.entries()) {
      const opt = optimisticMap.get(id)
      if (direction === 'bottom' && new Date(opt.endsAt).getTime() <= Date.now()) {
        throw { userMessage: 'No se puede reducir la ventana a un momento anterior a la línea de tiempo.' }
      }
      const conflict = _checkOverlapAbs(orig.specialistId, opt.startsAt, opt.endsAt, batchIds, orig.applicationId)
      if (conflict) {
        throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
      }
      const inheritErr = _checkInheritance(id, opt.scheduledDate, opt.startTime, opt.endTime)
      if (inheritErr) throw { userMessage: inheritErr }
    }

    windows.value = windows.value.map(w => optimisticMap.get(w.id) || w)
    _invalidateCache()

    let result
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
      result = await _enqueueGroupMutation(batchIds, () => batchUpdateWorkWindowsUseCase(items))
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(orig => ({
          window: orig,
          data: { startTime: orig.startTime, endTime: orig.endTime, targetDate: orig.scheduledDate, endDate: orig.endDate },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      _rollbackOptimistic(originals, optimisticMap)
      throw e
    }
    // Fallos por ítem (200 con failed[]): revertir esas y avisar
    _assertBatchOk(result, originals, optimisticMap)
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
          if (w.isSealed) continue   // selladas no se eliminan (regla de borrado)
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
          _markDeleted(splitCreatedIds)
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
    // Superada (LWW per-item, §15): el backend descartó este update porque ya
    // envió uno más nuevo para esta window — no-op; la ganadora pinta el estado.
    if (!updated) return w
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
    // El fin no puede retroceder detrás de la línea de tiempo (now): una
    // ventana en turno solo puede acortarse hasta el momento actual.
    if (endTime) {
      const newEnds = WorkWindow.toTimestampTz(original.endDate || original.scheduledDate, et)
      if (newEnds && new Date(newEnds).getTime() <= Date.now()) {
        throw { userMessage: 'No se puede reducir la ventana a un momento anterior a la línea de tiempo.' }
      }
    }
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
      await _enqueueMutation(w.id, () => updateWorkWindowUseCase(original, { startTime, endTime }))
      // Undo = resize back
      _pushUndo(snapshot, async () => {
        await updateWorkWindowUseCase(original, {
          startTime: original.startTime,
          endTime: original.endTime,
        })
      })
    } catch (e) {
      // Revertir SOLO si nuestro optimista sigue siendo el vigente; si hay un
      // movimiento más nuevo encima, no pisarlo (evita el brinco hacia atrás).
      if (_findOriginal(w.id) === optimistic) _replaceWindow(w.id, original)
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

    // Compute delta from the group's reference hour so each window shifts
    // by the same amount, preserving relative differences between windows.
    let direction, deltaMs
    if (endTime) {
      direction = 'bottom'
      const [eH, eM] = endTime.split(':').map(Number)
      const newEndMinutes = eH * 60 + eM
      const groupEndMinutes = Math.round(group.endHour * 60)
      deltaMs = (newEndMinutes - groupEndMinutes) * 60 * 1000
    } else if (startTime) {
      direction = 'top'
      const [sH, sM] = startTime.split(':').map(Number)
      const newStartMinutes = sH * 60 + sM
      const groupStartMinutes = Math.round(group.startHour * 60)
      deltaMs = (newStartMinutes - groupStartMinutes) * 60 * 1000
    }

    for (const gw of group.windows) {
      const orig = _findOriginal(gw.id)
      if (!orig) continue
      if (_isEnded(orig)) throw { userMessage: 'No se puede modificar un grupo con ventanas finalizadas.' }
      if (direction === 'top' && orig.isInShift) {
        throw { userMessage: 'No se puede cambiar el inicio de una ventana en turno activo. Solo se permite ajustar el fin.' }
      }
      originals.set(gw.id, orig)
      optimisticMap.set(gw.id, _applyDeltaMs(orig, direction, deltaMs).optimistic.withLocalUpdate())
    }

    // Validar overlap e inheritance contra ventanas externas al grupo
    for (const [id, orig] of originals.entries()) {
      const opt = optimisticMap.get(id)
      if (direction === 'bottom' && new Date(opt.endsAt).getTime() <= Date.now()) {
        throw { userMessage: 'No se puede reducir la ventana a un momento anterior a la línea de tiempo.' }
      }
      const conflict = _checkOverlapAbs(orig.specialistId, opt.startsAt, opt.endsAt, groupIds, orig.applicationId)
      if (conflict) {
        throw { userMessage: 'El horario se superpone con otra ventana del mismo especialista y aplicación.' }
      }
      const inheritErr = _checkInheritance(id, opt.scheduledDate, opt.startTime, opt.endTime)
      if (inheritErr) throw { userMessage: inheritErr }
    }

    windows.value = windows.value.map(w => optimisticMap.get(w.id) || w)
    _invalidateCache()

    let result
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
      result = await _enqueueGroupMutation(groupIds, () => batchUpdateWorkWindowsUseCase(items))
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(orig => ({
          window: orig,
          data: { startTime: orig.startTime, endTime: orig.endTime, targetDate: orig.scheduledDate, endDate: orig.endDate },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      _rollbackOptimistic(originals, optimisticMap)
      throw e
    }
    // Fallos por ítem (200 con failed[]): revertir esas y avisar
    _assertBatchOk(result, originals, optimisticMap)
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
    // No permitir mover el inicio al pasado (validación rápida en el front).
    const effStart = startTime != null ? startTime : original.startTime
    if (_startsInPast(WorkWindow.toTimestampTz(date, effStart))) {
      throw { userMessage: _PAST_MOVE_MSG }
    }
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
      await _enqueueMutation(w.id, () => rescheduleWorkWindowUseCase(original, { startTime, endTime, targetDate }))
      // Undo = reschedule back
      _pushUndo(snapshot, async () => {
        await rescheduleWorkWindowUseCase(
          { id: original.id, scheduledDate: targetDate },
          { startTime: original.startTime, endTime: original.endTime, targetDate: original.scheduledDate }
        )
      })
    } catch (e) {
      // Revertir SOLO si nuestro optimista sigue vigente (ver resizeWindow).
      if (_findOriginal(w.id) === optimistic) _replaceWindow(w.id, original)
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
      if (_startsInPast(raw.starts_at)) throw { userMessage: _PAST_MOVE_MSG }
      optimisticMap.set(gw.id, new WorkWindow(raw).withLocalUpdate())
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

    let result
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
      result = await _enqueueGroupMutation(groupIds, () => batchUpdateWorkWindowsUseCase(items))
      _pushUndo(snapshot, async () => {
        const undoItems = [...originals.values()].map(orig => ({
          window: orig,
          data: { startTime: orig.startTime, endTime: orig.endTime, targetDate: orig.scheduledDate, endDate: orig.endDate },
        }))
        await batchUpdateWorkWindowsUseCase(undoItems)
      })
    } catch (e) {
      _rollbackOptimistic(originals, optimisticMap)
      throw e
    }
    // Fallos por ítem (200 con failed[]): revertir esas y avisar
    _assertBatchOk(result, originals, optimisticMap)
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
  // El backend difunde los eventos también al cliente que originó la mutación
  // (eco). Sin guardas, ese eco pisa el estado optimista local y produce:
  //  - duplicado momentáneo al crear (placeholder + ventana real del eco), y
  //  - "brincos" al mover/redimensionar rápido (el eco del movimiento N-1
  //    llega cuando ya se aplicó el optimista del movimiento N y lo revierte).
  // Se aplica aquí la MISMA regla CRDT LWW de _mergeWindows: un cambio local
  // reciente (_localUpdatedAt < _RECENT_WINDOW_MS) gana sobre lo remoto.

  /** CRDT LWW: true si la copia local fue modificada hace poco y debe ganar. */
  function _isRecentLocal(id) {
    const w = windows.value.find(x => x.id === id)
    return !!(w && w._localUpdatedAt &&
      Date.now() - new Date(w._localUpdatedAt).getTime() < _RECENT_WINDOW_MS)
  }

  function onWindowCreatedRT(data) {
    const items = Array.isArray(data) ? data : [data]
    const existingIds = new Set(windows.value.map(w => w.id))
    const incoming = items
      .map(d => new WorkWindow(d).withLocalUpdate())
      .filter(w => !existingIds.has(w.id) && !_isRecentlyDeleted(w.id))
    if (incoming.length === 0) return

    // Si la ventana entrante corresponde a un placeholder optimista nuestro
    // (misma especialista+app y mismos instantes), lo SUSTITUYE en vez de
    // convivir con él — es lo que se veía como "duplicada por un momento".
    const matchesPlaceholder = (ph, w) =>
      ph.specialistId === w.specialistId &&
      ph.applicationId === w.applicationId &&
      new Date(ph.startsAt).getTime() === new Date(w.startsAt).getTime() &&
      new Date(ph.endsAt).getTime() === new Date(w.endsAt).getTime()

    const replacedPlaceholders = new Set()
    for (const w of incoming) {
      const ph = windows.value.find(x => _isPlaceholder(x.id) && !replacedPlaceholders.has(x.id) && matchesPlaceholder(x, w))
      if (ph) replacedPlaceholders.add(ph.id)
    }
    windows.value = [
      ...windows.value.filter(w => !replacedPlaceholders.has(w.id)),
      ...incoming,
    ]
    _invalidateCache()
  }

  function onWindowUpdatedRT(data) {
    const updated = new WorkWindow(data)
    if (_isRecentLocal(updated.id) || _isRecentlyDeleted(updated.id)) return
    _replaceWindow(updated.id, updated)
  }

  function onWindowDeletedRT(data) {
    const id = typeof data === 'string' ? data : data.id
    _markDeleted([id])   // tombstone: que un fetch stale no la resucite
    _removeWindow(id)
  }

  function onWindowToggledRT(data) {
    const updated = new WorkWindow(data)
    if (_isRecentLocal(updated.id) || _isRecentlyDeleted(updated.id)) return
    _replaceWindow(updated.id, updated)
  }

  function onWindowMergedRT(data) {
    // data: { mode, deleted_ids: [...], windows: [<raw window>, ...] }
    if (data.deleted_ids) {
      _markDeleted(data.deleted_ids)
      for (const id of data.deleted_ids) _removeWindow(id)
    }
    const items = data.windows || []
    for (const raw of items) {
      const ww = new WorkWindow(raw)
      if (_isRecentLocal(ww.id) || _isRecentlyDeleted(ww.id)) continue
      const exists = windows.value.some(w => w.id === ww.id)
      if (exists) _replaceWindow(ww.id, ww)
      else _addWindows([ww])
    }
  }

  function onWindowBatchRT(data) {
    // Invalidate cache and force re-fetch
    _deleteCurrentCache()
    loadWindows()
  }

  async function forceReload() {
    _deleteCurrentCache()
    await loadWindows()
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
    forceReload,

    // Undo
    canUndo,
    undo,

    // Filters
    hiddenSpecs,
    hiddenApps,
    showActive,
    showInactive,
    toggleSpecFilter,
    toggleAppFilter,
    setAllSpecs,
    setAllApps,
    toggleShowActive,
    toggleShowInactive,
    specialistsConVentana,

    // Crear seam (CalSidebar → CalendarioView)
    createRequest,
    requestCreate,

    // CRUD
    createWindows,
    createRecurringWindows,
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

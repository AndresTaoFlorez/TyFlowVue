import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { SyncEngine } from '@/infrastructure/sync/SyncEngine'
import { fetchCasesUseCase } from '@/application/use-cases/cases/FetchCasesUseCase'
import { fetchCaseByIdUseCase } from '@/application/use-cases/cases/FetchCaseByIdUseCase'
import { createCaseUseCase } from '@/application/use-cases/cases/CreateCaseUseCase'
import { updateCaseUseCase } from '@/application/use-cases/cases/UpdateCaseUseCase'
import { updateCaseStatusUseCase } from '@/application/use-cases/cases/UpdateCaseStatusUseCase'
import { assignCaseWddUseCase } from '@/application/use-cases/cases/AssignCaseWddUseCase'
import { assignCaseManualUseCase } from '@/application/use-cases/cases/AssignCaseManualUseCase'
import { reassignCaseUseCase } from '@/application/use-cases/cases/ReassignCaseUseCase'
import { assignCaseWddAutopilotUseCase } from '@/application/use-cases/cases/AssignCaseWddAutopilotUseCase'
import { fetchSpecialistWorkloadsUseCase } from '@/application/use-cases/cases/FetchSpecialistWorkloadsUseCase'
import { fetchAssignmentTotalUseCase } from '@/application/use-cases/assignments/FetchAssignmentTotalUseCase'
import { Case } from '@/domain/entities/Case'
import { useUserStore } from '@/presentation/stores/useUserStore'

localStorage.removeItem('tyflow_cases_v1')

const casesSync = new SyncEngine({
  cacheKey: 'tyflow_cases_v2',
  hydrate: (raw) => new Case(raw),
  fetchRemote: null, // set dynamically per-filter
  getId: (item) => item.id,
})

// Workloads son sesión-only (cacheKey: null → sin localStorage).
// Todas las mutaciones — incluyendo las del WebSocket — pasan por workloadSync.
const workloadSync = new SyncEngine({
  cacheKey: null,
  hydrate: (raw) => raw,
  fetchRemote: null,
  getId: (w) => w.specialist_id,
})

// allWorkloads: filas por (specialist, app) — key compuesta para updates precisos por RT.
// application_id ahora viene del backend en cada fila (API contract §10d).
const allWorkloadsSync = new SyncEngine({
  cacheKey: null,
  hydrate: (raw) => raw,
  fetchRemote: null,
  getId: (w) => `${w.specialist_id}|${w.application_id}`,
})

// cargasCases: casos del especialista abierto en el panel de Cargas.
const cargasCasesSync = new SyncEngine({
  cacheKey: null,
  hydrate: (raw) => new Case(raw),
  fetchRemote: null,
  getId: (c) => c.id,
})

export const useCasesStore = defineStore('cases', () => {
  // ── State ──
  const cases = ref(casesSync.loadFromCache())
  const selectedCase = ref(null)
  const selectedIndex = ref(-1)

  const _FILTERS_KEY = 'tyflow_cases_filters_v1'
  const _savedFilters = (() => {
    try { return JSON.parse(localStorage.getItem(_FILTERS_KEY)) ?? {} } catch { return {} }
  })()
  const filters = ref({
    status:        _savedFilters.status        ?? 'open',
    originType:    _savedFilters.originType    ?? null,
    priority:      _savedFilters.priority      ?? null,
    applicationId: _savedFilters.applicationId ?? null,
    specialistId:  null, // never persisted — set per auth context on mount
  })
  const pagination = ref({ page: 1, pageSize: 50, total: 0 })
  const specialistWorkloads = ref([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const loadingDetail = ref(false)
  const assigning = ref(false)
  const listError = ref(null)
  const detailError = ref(null)
  const actionError = ref(null)

  // ── Autopilot state ──
  const autopilotState = ref({ running: false, jobId: null, processed: 0, total: null })

  // ── Cargas view state (SyncEngine is the source of truth) ──
  // allWorkloads: flat list of workload rows for ALL apps — feeds the Cargas panel 1.
  // RT events (assign/reassign) update it reactively so counters stay live.
  const allWorkloads            = ref([])
  const loadingAllWorkloads     = ref(false)
  const cargasSpecialistId      = ref(null)   // which specialist is open in Cargas panel 2
  const cargasCases             = ref([])     // cases for that specialist (all statuses)
  const loadingCargasCases      = ref(false)
  const cargasTotalAssignments  = ref(0)      // total histórico de asignaciones del especialista

  // ── Search state ──
  const searchMode    = ref(false)
  const searchResults = ref([])
  const searchQuery   = ref('')
  const searchLoading = ref(false)
  const searchError   = ref(null)

  // ── Modal state ──
  const showDetailModal = ref(false)
  const showCreateModal = ref(false)

  // Persist non-auth filters across sessions (specialistId excluded intentionally)
  watch(filters, (f) => {
    try {
      localStorage.setItem(_FILTERS_KEY, JSON.stringify({
        status: f.status, originType: f.originType,
        priority: f.priority, applicationId: f.applicationId,
      }))
    } catch { /* quota exceeded — silent */ }
  }, { deep: true })

  // ── Computed ──
  const caseCount = computed(() => pagination.value.total)
  const hasMore = computed(() => cases.value.length < pagination.value.total)

  const workloadsByLevel = computed(() => {
    const groups = {}
    for (const w of specialistWorkloads.value) {
      const lvl = w.support_level_name ?? 'General'
      if (!groups[lvl]) groups[lvl] = []
      groups[lvl].push(w)
    }
    return groups
  })

  const hasPrev = computed(() => selectedIndex.value > 0)
  // hasNext is true when there's a next loaded case OR more pages exist in the backend
  const hasNext = computed(() =>
    selectedIndex.value < cases.value.length - 1 ||
    cases.value.length < pagination.value.total
  )

  // ── Helpers ──
  function _filterKey() {
    const f = filters.value
    return [f.status, f.originType, f.priority, f.applicationId, f.specialistId].join('|')
  }

  function _humanizeError(e) {
    const raw = e?.response?.data?.detail ?? e.message ?? ''
    if (!raw) return 'Error desconocido'
    const userStore = useUserStore()
    const catalogs = [
      ...(userStore.applications ?? []),
      ...(userStore.supportLevels ?? []),
      ...(userStore.supportCategories ?? []),
    ]
    // Two lookup tables:
    // 1. Full UUID (with dashes, case-insensitive) → display name
    // 2. 6-char hex prefix (backend truncates UUIDs in error messages) → display name
    const byFullId  = new Map(catalogs.map(c => [c.id.toLowerCase(), c.name]))
    const byShortId = new Map(
      catalogs.map(c => [c.id.replace(/-/g, '').slice(0, 6).toLowerCase(), c.name])
    )

    return raw
      // Full UUIDs first
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (uuid) => {
        const name = byFullId.get(uuid.toLowerCase())
        return name ? `"${name}"` : uuid
      })
      // 6-char hex short IDs (truncated UUIDs from backend error messages)
      .replace(/\b([0-9a-f]{6})\b/gi, (short) => {
        const name = byShortId.get(short.toLowerCase())
        return name ? `"${name}"` : short
      })
  }

  // Per-filter in-memory cache: filterKey → { data, total }
  // Enables instant restoration when the user switches back to a previously-loaded filter.
  const _filterCache = new Map()

  // ── Actions ──
  async function loadCases(newFilters) {
    if (newFilters) {
      // No-op if same filter clicked again
      const before = _filterKey()
      Object.assign(filters.value, newFilters)
      if (_filterKey() === before) return
      pagination.value.page = 1
      // Exit search mode when filters change
      searchMode.value = false
      searchResults.value = []
      searchQuery.value = ''
      searchError.value = null
    }

    const fKey = _filterKey()
    const isPage1 = pagination.value.page === 1
    listError.value = null

    if (isPage1) {
      const cached = _filterCache.get(fKey)
      if (cached) {
        // Restore from in-memory cache instantly — no skeleton, silent revalidation
        cases.value = cached.data
        pagination.value.total = cached.total
      } else if (cases.value.length === 0) {
        loading.value = true       // first load for this filter — show skeleton
      }
      // else: stale data visible while we revalidate silently
    } else {
      loadingMore.value = true     // infinite-scroll page
    }

    try {
      const result = await fetchCasesUseCase({
        ...filters.value,
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
      })
      if (isPage1) {
        casesSync.replaceAll(cases, result.data)
        _filterCache.set(fKey, { data: [...result.data], total: result.total })
      } else {
        // Append for infinite scroll; update cache so back-navigation stays correct
        const appended = [...cases.value, ...result.data]
        cases.value = appended
        casesSync.writeToCache(appended)
        _filterCache.set(fKey, { data: appended, total: result.total })
      }
      pagination.value.total = result.total
      pagination.value.page = result.page
    } catch (e) {
      // Only surface the error if we have nothing to show
      if (cases.value.length === 0) {
        listError.value = _humanizeError(e) || 'Error cargando casos'
      }
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  async function loadPage(page) {
    if (loading.value || loadingMore.value) return  // prevent duplicate concurrent loads
    pagination.value.page = page
    await loadCases()
  }

  // ── Detail modal helpers ──
  function openDetail(index) {
    selectedIndex.value = index
    const c = cases.value[index]
    if (c) {
      selectedCase.value = c
      showDetailModal.value = true
      // Fetch fresh detail in background
      loadCaseById(c.id)
    }
  }

  function openDetailById(id) {
    const idx = cases.value.findIndex(c => c.id === id)
    if (idx !== -1) {
      openDetail(idx)
    } else {
      selectedIndex.value = -1
      showDetailModal.value = true
      loadCaseById(id)
    }
  }

  function closeDetail() {
    showDetailModal.value = false
    selectedCase.value = null
    selectedIndex.value = -1
  }

  function goToPrev() {
    if (hasPrev.value) openDetail(selectedIndex.value - 1)
  }

  async function goToNext() {
    if (!hasNext.value) return
    const nextIdx = selectedIndex.value + 1

    if (nextIdx < cases.value.length) {
      openDetail(nextIdx)
      // Look-ahead: when within 8 of the end, start loading next page silently
      if (nextIdx >= cases.value.length - 8 && hasMore.value && !loadingMore.value) {
        loadPage(pagination.value.page + 1)
      }
      return
    }

    // Reached the end of loaded cases — need more from backend.
    // Start a load only if nothing is already in flight.
    if (hasMore.value && !loadingMore.value) {
      loadPage(pagination.value.page + 1)
    }

    // Whether we just started a load or one was already in flight (look-ahead),
    // wait until loadingMore goes back to false before navigating.
    if (loadingMore.value) {
      await new Promise(resolve => {
        const stop = watch(loadingMore, (v) => { if (!v) { stop(); resolve() } })
      })
    }

    if (nextIdx < cases.value.length) {
      openDetail(nextIdx)
    }
  }

  async function loadCaseById(id) {
    loadingDetail.value = true
    detailError.value = null
    try {
      const fresh = await fetchCaseByIdUseCase(id)
      // Guard: discard result if the user navigated to a different case while fetching
      if (selectedCase.value?.id !== id) return
      selectedCase.value = fresh
      // Sync the fresh detail back to the list (no CRDT stamp — data is from backend)
      const idx = cases.value.findIndex(c => c.id === id)
      if (idx !== -1) {
        cases.value = [
          ...cases.value.slice(0, idx),
          fresh,
          ...cases.value.slice(idx + 1),
        ]
        casesSync.writeToCache(cases.value)
      }
    } catch (e) {
      if (selectedCase.value?.id === id) {
        detailError.value = _humanizeError(e) || 'Error cargando caso'
      }
    } finally {
      if (selectedCase.value?.id === id || !selectedCase.value) {
        loadingDetail.value = false
      }
    }
  }

  async function createCase(payload) {
    assigning.value = true
    actionError.value = null
    try {
      const created = await createCaseUseCase(payload)
      if (filters.value.status === 'open' || !filters.value.status) {
        casesSync.insertLocal(cases, created)
        pagination.value.total++
      }
      return created
    } catch (e) {
      actionError.value = _humanizeError(e)
      throw e
    } finally {
      assigning.value = false
    }
  }

  async function updateCase(id, fields) {
    actionError.value = null
    try {
      const updated = await updateCaseUseCase(id, fields)
      const idx = cases.value.findIndex(c => c.id === id)
      if (idx !== -1) {
        casesSync.updateLocal(cases, id, updated)
      }
      if (selectedCase.value?.id === id) selectedCase.value = updated
      return updated
    } catch (e) {
      actionError.value = _humanizeError(e)
      throw e
    }
  }

  async function updateCaseStatus(id, status) {
    actionError.value = null
    try {
      const updated = await updateCaseStatusUseCase(id, status)
      const idx = cases.value.findIndex(c => c.id === id)
      if (idx !== -1) {
        if (filters.value.status && updated.status !== filters.value.status) {
          casesSync.removeLocal(cases, id)
          pagination.value.total--
        } else {
          casesSync.updateLocal(cases, id, updated)
        }
      }
      if (selectedCase.value?.id === id) selectedCase.value = updated
      // Keep cargasCases in sync
      if (cargasCases.value.find(c => c.id === id)) {
        cargasCasesSync.updateLocal(cargasCases, id, updated)
      }
      return updated
    } catch (e) {
      actionError.value = _humanizeError(e)
      throw e
    }
  }

  async function assignWdd(payload) {
    assigning.value = true
    actionError.value = null
    try {
      const result = await assignCaseWddUseCase(payload)
      await loadCaseById(payload.caseId)
      if (filters.value.status === 'open') {
        casesSync.removeLocal(cases, payload.caseId)
        pagination.value.total--
      }
      return result
    } catch (e) {
      actionError.value = _humanizeError(e)
      throw e
    } finally {
      assigning.value = false
    }
  }

  async function assignManual(payload) {
    assigning.value = true
    actionError.value = null
    try {
      const result = await assignCaseManualUseCase(payload)
      await loadCaseById(payload.caseId)
      if (filters.value.status === 'open') {
        casesSync.removeLocal(cases, payload.caseId)
        pagination.value.total--
      }
      return result
    } catch (e) {
      actionError.value = _humanizeError(e)
      throw e
    } finally {
      assigning.value = false
    }
  }

  async function reassign(payload) {
    assigning.value = true
    actionError.value = null
    try {
      const result = await reassignCaseUseCase(payload)
      await loadCaseById(payload.caseId)
      return result
    } catch (e) {
      actionError.value = _humanizeError(e)
      throw e
    } finally {
      assigning.value = false
    }
  }

  async function triggerAutopilot(filters = {}) {
    try {
      const result = await assignCaseWddAutopilotUseCase(filters)
      autopilotState.value = { running: true, jobId: result.job_id, processed: 0, total: null }
      return result
    } catch (e) {
      if (e.response?.status === 409) throw new Error('Ya hay un job de autopilot en progreso')
      throw e
    }
  }

  // ── Search ──

  // Scan all locally cached data (current list + every filter cache) for query matches.
  function _localSearch(q) {
    const upper = q.toUpperCase()
    const seen = new Set()
    const matches = []
    const check = (list) => {
      for (const c of list) {
        if (seen.has(c.id)) continue
        const short = c.id.slice(0, 6).toUpperCase()
        if (short.startsWith(upper.slice(0, 6)) || c.id.toLowerCase() === q.toLowerCase()) {
          seen.add(c.id)
          matches.push(c)
        }
      }
    }
    check(cases.value)
    for (const { data } of _filterCache.values()) check(data)
    return matches
  }

  // Live filter as user types — local only, no API call.
  function filterCasesLocally(query) {
    const q = query.replace(/^#/, '').trim()
    if (!q) { clearSearch(); return }
    searchQuery.value = query
    searchError.value = null
    const matches = _localSearch(q)
    searchMode.value = true
    searchResults.value = matches
  }

  // Full search on Enter — local first, then API if nothing found.
  async function searchCases(query) {
    const q = query.replace(/^#/, '').trim()
    if (!q) { clearSearch(); return }
    searchQuery.value = query
    searchError.value = null

    const local = _localSearch(q)
    if (local.length > 0) {
      searchMode.value = true
      searchResults.value = local
      return
    }

    // Short IDs → local only (API has no q param)
    const cleanQ = q.replace(/-/g, '')
    const isUUID = /^[0-9a-f]{32}$/i.test(cleanQ)
    if (!isUUID) {
      searchMode.value = true
      searchResults.value = []
      searchError.value = 'No se encontraron casos'
      return
    }

    // Full UUID → fetch by ID directly
    searchLoading.value = true
    searchMode.value = true
    try {
      const c = await fetchCaseByIdUseCase(q)
      searchResults.value = [c]
    } catch {
      searchError.value = 'No se encontró el caso'
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }

  function clearSearch() {
    searchMode.value = false
    searchResults.value = []
    searchQuery.value = ''
    searchError.value = null
  }

  // ── Cargas helpers ──

  let _loadAllWorkloadsInFlight = false

  function _getAppIdForCase(caseId) {
    return cases.value.find(c => c.id === caseId)?.applicationId
      ?? (selectedCase.value?.id === caseId ? selectedCase.value.applicationId : null)
      ?? cargasCases.value.find(c => c.id === caseId)?.applicationId
      ?? null
  }

  // Incrementa/decrementa el contador de una fila de allWorkloads.
  // Si appId es conocido actualiza la fila exacta; si no, actualiza la primera fila del specialist.
  function _updateAllWorkloadCounts(specialistId, delta, appId) {
    const rows = allWorkloads.value.filter(w => w.specialist_id === specialistId)
    if (!rows.length) return
    const targetRow = (appId ? rows.find(r => r.application_id === appId) : null) ?? rows[0]
    allWorkloadsSync.updateLocal(allWorkloads, `${targetRow.specialist_id}|${targetRow.application_id}`, {
      ...targetRow, current_count: Math.max(0, (targetRow.current_count ?? 0) + delta),
    })
  }

  async function loadAllWorkloads(applicationIds) {
    if (_loadAllWorkloadsInFlight || !applicationIds?.length) return
    _loadAllWorkloadsInFlight = true
    loadingAllWorkloads.value = true
    try {
      // application_id ya viene en cada fila de la respuesta (API contract §10d)
      const results = await Promise.all(
        applicationIds.map(appId =>
          fetchSpecialistWorkloadsUseCase(appId).catch(() => [])
        )
      )
      allWorkloadsSync.replaceAll(allWorkloads, results.flat())
    } finally {
      loadingAllWorkloads.value = false
      _loadAllWorkloadsInFlight = false
    }
  }

  async function loadCargasCases(specialistId) {
    if (cargasSpecialistId.value !== specialistId) {
      cargasSpecialistId.value = specialistId
      cargasCasesSync.replaceAll(cargasCases, [])
    }
    loadingCargasCases.value = true
    try {
      const [casesResult, total] = await Promise.all([
        fetchCasesUseCase({ specialistId, pageSize: 200 }),
        fetchAssignmentTotalUseCase(specialistId),
      ])
      cargasCasesSync.replaceAll(cargasCases, casesResult.data ?? [])
      cargasTotalAssignments.value = total
    } catch { /* silent */ }
    finally { loadingCargasCases.value = false }
  }

  const _workloadCache = new Map()

  async function loadWorkloads(applicationId, { supportLevelId, supportCategoryId } = {}) {
    const cacheKey = [applicationId, supportLevelId, supportCategoryId]
      .filter(Boolean).join('|')
    // Serve from cache instantly, then revalidate
    const cached = _workloadCache.get(cacheKey)
    if (cached) workloadSync.replaceAll(specialistWorkloads, cached)
    try {
      const fresh = await fetchSpecialistWorkloadsUseCase(applicationId, { supportLevelId, supportCategoryId })
      workloadSync.replaceAll(specialistWorkloads, fresh)
      _workloadCache.set(cacheKey, fresh)
    } catch { /* silent */ }
  }

  // ── Realtime mutations ──

  /** Matches a Case against all active filters */
  function _matchesFilters(c) {
    const f = filters.value
    if (f.status && c.status !== f.status) return false
    if (f.originType && c.originType !== f.originType) return false
    if (f.priority && c.priority !== f.priority) return false
    if (f.applicationId && c.applicationId !== f.applicationId) return false
    if (f.specialistId && c.specialistId !== f.specialistId) return false
    return true
  }

  function onCaseCreatedRT(data) {
    const c = new Case(data)
    if (!_matchesFilters(c)) return
    if (!cases.value.find(x => x.id === c.id)) {
      casesSync.insertLocal(cases, c)
      pagination.value.total++
    }
  }

  function onCaseAssignedRT(data) {
    const idx = cases.value.findIndex(c => c.id === data.case_id)
    let removedFromList = false
    if (idx !== -1) {
      if (filters.value.status === 'open') {
        casesSync.removeLocal(cases, data.case_id)
        pagination.value.total--
        removedFromList = true
      } else {
        const updated = new Case({ ...cases.value[idx]._toRaw(), status: 'assigned', specialist_id: data.specialist_id })
        casesSync.updateLocal(cases, data.case_id, updated)
      }
    }
    if (selectedCase.value?.id === data.case_id) {
      // Never auto-close on assignment — the user is actively viewing this case.
      // Just reflect the new status so the detail stays in sync.
      selectedCase.value = new Case({
        ...selectedCase.value._toRaw(),
        status: 'assigned',
        specialist_id: data.specialist_id,
        assigned_at: new Date().toISOString(),
      })
    }
    // Update workloadSync (for the assign modal dropdown)
    const w = specialistWorkloads.value.find(s => s.specialist_id === data.specialist_id)
    if (w) workloadSync.updateLocal(specialistWorkloads, w.specialist_id, {
      ...w, current_count: (w.current_count ?? 0) + 1,
    })
    // Update allWorkloads counters (for Cargas panel 1)
    _updateAllWorkloadCounts(data.specialist_id, +1, _getAppIdForCase(data.case_id))
    // Update cargasCases (for Cargas panel 2)
    if (data.specialist_id === cargasSpecialistId.value) {
      const existing = cargasCases.value.find(c => c.id === data.case_id)
      if (existing) {
        cargasCasesSync.updateLocal(cargasCases, data.case_id,
          new Case({ ...existing._toRaw(), status: 'assigned', specialist_id: data.specialist_id }))
      } else {
        const src = cases.value.find(c => c.id === data.case_id)
          ?? (selectedCase.value?.id === data.case_id ? selectedCase.value : null)
        if (src) {
          cargasCasesSync.insertLocal(cargasCases,
            new Case({ ...src._toRaw(), status: 'assigned', specialist_id: data.specialist_id }))
        }
      }
    }
  }

  function onCaseReassignedRT(data) {
    const idx = cases.value.findIndex(c => c.id === data.case_id)
    if (idx !== -1) {
      const updated = new Case({ ...cases.value[idx]._toRaw(), specialist_id: data.to_specialist_id })
      casesSync.updateLocal(cases, data.case_id, updated)
    }
    if (selectedCase.value?.id === data.case_id) {
      selectedCase.value = new Case({ ...selectedCase.value._toRaw(), specialist_id: data.to_specialist_id })
    }
    // Update workloadSync (for assign modal dropdown)
    const fromW = specialistWorkloads.value.find(s => s.specialist_id === data.from_specialist_id)
    if (fromW && fromW.current_count > 0)
      workloadSync.updateLocal(specialistWorkloads, fromW.specialist_id, {
        ...fromW, current_count: fromW.current_count - 1,
      })
    const toW = specialistWorkloads.value.find(s => s.specialist_id === data.to_specialist_id)
    if (toW)
      workloadSync.updateLocal(specialistWorkloads, toW.specialist_id, {
        ...toW, current_count: (toW.current_count ?? 0) + 1,
      })
    // Update allWorkloads counters (for Cargas panel 1)
    const appId = _getAppIdForCase(data.case_id)
    _updateAllWorkloadCounts(data.from_specialist_id, -1, appId)
    _updateAllWorkloadCounts(data.to_specialist_id, +1, appId)
    // Update cargasCases (for Cargas panel 2)
    if (data.from_specialist_id === cargasSpecialistId.value) {
      // Case left this specialist
      cargasCasesSync.removeLocal(cargasCases, data.case_id)
    }
    if (data.to_specialist_id === cargasSpecialistId.value) {
      // Case arrived at this specialist
      const existing = cargasCases.value.find(c => c.id === data.case_id)
      if (!existing) {
        const src = cases.value.find(c => c.id === data.case_id)
          ?? (selectedCase.value?.id === data.case_id ? selectedCase.value : null)
        if (src) {
          cargasCasesSync.insertLocal(cargasCases,
            new Case({ ...src._toRaw(), specialist_id: data.to_specialist_id }))
        }
      } else {
        cargasCasesSync.updateLocal(cargasCases, data.case_id,
          new Case({ ...existing._toRaw(), specialist_id: data.to_specialist_id }))
      }
    }
  }

  function onAutopilotStartedRT(data) {
    autopilotState.value = { running: true, jobId: data.job_id ?? autopilotState.value.jobId, processed: 0, total: data.total ?? null }
  }

  function onAutopilotProgressRT(data) {
    autopilotState.value = { ...autopilotState.value, running: true, processed: data.processed ?? 0, total: data.total ?? autopilotState.value.total }
  }

  function onAutopilotCompletedRT(data) {
    autopilotState.value = { running: false, jobId: null, processed: 0, total: null }
    loadCases()
  }

  function onCaseUpdatedRT(data) {
    // case.updated payload only carries { case_id, status, previous_status } — merge status only
    const idx = cases.value.findIndex(c => c.id === data.case_id)
    let removedFromList = false
    if (idx !== -1) {
      const merged = new Case({ ...cases.value[idx]._toRaw(), status: data.status })
      if (!_matchesFilters(merged)) {
        casesSync.removeLocal(cases, data.case_id)
        pagination.value.total--
        removedFromList = true
      } else {
        casesSync.updateLocal(cases, data.case_id, merged)
      }
    }
    if (selectedCase.value?.id === data.case_id) {
      if (removedFromList) {
        closeDetail()
      } else {
        selectedCase.value = new Case({ ...selectedCase.value._toRaw(), status: data.status })
      }
    }
    // Update cargasCases if the case is there
    const cargasIdx = cargasCases.value.findIndex(c => c.id === data.case_id)
    if (cargasIdx !== -1) {
      cargasCasesSync.updateLocal(cargasCases, data.case_id,
        new Case({ ...cargasCases.value[cargasIdx]._toRaw(), status: data.status }))
    }
  }

  return {
    cases, selectedCase, selectedIndex, filters, pagination,
    specialistWorkloads,
    loading, loadingMore, loadingDetail, assigning, listError, detailError, actionError,
    searchMode, searchResults, searchQuery, searchLoading, searchError,
    showDetailModal, showCreateModal,
    caseCount, hasMore, workloadsByLevel, hasPrev, hasNext,
    autopilotState,
    // Cargas view state
    allWorkloads, loadingAllWorkloads,
    cargasSpecialistId, cargasCases, loadingCargasCases, cargasTotalAssignments,
    loadCases, loadPage, loadCaseById,
    filterCasesLocally, searchCases, clearSearch,
    openDetail, openDetailById, closeDetail, goToPrev, goToNext,
    createCase, updateCase, updateCaseStatus,
    assignWdd, assignManual, reassign, triggerAutopilot,
    loadWorkloads, loadAllWorkloads, loadCargasCases,
    onCaseCreatedRT, onCaseAssignedRT, onCaseReassignedRT, onCaseUpdatedRT,
    onAutopilotStartedRT, onAutopilotProgressRT, onAutopilotCompletedRT,
  }
})

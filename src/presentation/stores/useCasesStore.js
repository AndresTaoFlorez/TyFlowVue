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
import { Case } from '@/domain/entities/Case'
import { useUserStore } from '@/presentation/stores/useUserStore'

const casesSync = new SyncEngine({
  cacheKey: 'tyflow_cases_v1',
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
const allWorkloadsSync = new SyncEngine({
  cacheKey: null,
  hydrate: (raw) => raw,
  fetchRemote: null,
  getId: (w) => `${w.specialist_id}|${w._appId}`,
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
  const allWorkloads         = ref([])
  const loadingAllWorkloads  = ref(false)
  const cargasSpecialistId   = ref(null)   // which specialist is open in Cargas panel 2
  const cargasCases          = ref([])     // cases for that specialist (all statuses)
  const loadingCargasCases   = ref(false)

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
  const hasNext = computed(() => selectedIndex.value < cases.value.length - 1)

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
    return raw.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (uuid) => {
      const match = catalogs.find(c => c.id === uuid)
      return match ? `"${match.name}"` : uuid
    })
  }

  // ── Actions ──
  async function loadCases(newFilters) {
    if (newFilters) {
      // No-op if same filter clicked again
      const before = _filterKey()
      Object.assign(filters.value, newFilters)
      if (_filterKey() === before) return
      // Filter changed: reset page and clear stale data so skeleton shows
      pagination.value.page = 1
      cases.value = []
    }

    const isPage1 = pagination.value.page === 1
    if (cases.value.length === 0) {
      loading.value = true       // show skeleton on empty state (filter change or first load)
    } else if (!isPage1) {
      loadingMore.value = true   // show bottom spinner for infinite-scroll pages
    }
    // else: silent background revalidation — cached data stays visible
    listError.value = null

    try {
      const result = await fetchCasesUseCase({
        ...filters.value,
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
      })
      if (isPage1) {
        casesSync.replaceAll(cases, result.data)
      } else {
        // Append for infinite scroll
        const appended = [...cases.value, ...result.data]
        cases.value = appended
        casesSync.writeToCache(appended)
      }
      pagination.value.total = result.total
      pagination.value.page = result.page
    } catch (e) {
      listError.value = _humanizeError(e) || 'Error cargando casos'
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

  function goToNext() {
    if (hasNext.value) openDetail(selectedIndex.value + 1)
  }

  async function loadCaseById(id) {
    loadingDetail.value = true
    detailError.value = null
    try {
      const fresh = await fetchCaseByIdUseCase(id)
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
      detailError.value = _humanizeError(e) || 'Error cargando caso'
    } finally {
      loadingDetail.value = false
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

  async function triggerAutopilot() {
    try {
      const result = await assignCaseWddAutopilotUseCase()
      autopilotState.value = { running: true, jobId: result.job_id, processed: 0, total: null }
      return result
    } catch (e) {
      if (e.response?.status === 409) throw new Error('Ya hay un job de autopilot en progreso')
      throw e
    }
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
    const targetRow = (appId ? rows.find(r => r._appId === appId) : null) ?? rows[0]
    allWorkloadsSync.updateLocal(allWorkloads, `${targetRow.specialist_id}|${targetRow._appId}`, {
      ...targetRow, current_count: Math.max(0, (targetRow.current_count ?? 0) + delta),
    })
  }

  async function loadAllWorkloads(applicationIds) {
    if (_loadAllWorkloadsInFlight || !applicationIds?.length) return
    _loadAllWorkloadsInFlight = true
    loadingAllWorkloads.value = true
    try {
      const results = await Promise.all(
        applicationIds.map(appId =>
          fetchSpecialistWorkloadsUseCase(appId)
            .then(rows => rows.map(r => ({ ...r, _appId: appId })))
            .catch(() => [])
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
      const result = await fetchCasesUseCase({ specialistId, pageSize: 200 })
      cargasCasesSync.replaceAll(cargasCases, result.data ?? [])
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
      if (removedFromList) {
        closeDetail()
      } else {
        selectedCase.value = new Case({
          ...selectedCase.value._toRaw(),
          status: 'assigned',
          specialist_id: data.specialist_id,
          assigned_at: new Date().toISOString(),
        })
      }
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
    const idx = cases.value.findIndex(c => c.id === data.case_id)
    let removedFromList = false
    if (idx !== -1) {
      const merged = new Case({ ...cases.value[idx]._toRaw(), ...data })
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
        selectedCase.value = new Case({ ...selectedCase.value._toRaw(), ...data })
      }
    }
    // Update cargasCases if the case is there
    const cargasIdx = cargasCases.value.findIndex(c => c.id === data.case_id)
    if (cargasIdx !== -1) {
      cargasCasesSync.updateLocal(cargasCases, data.case_id,
        new Case({ ...cargasCases.value[cargasIdx]._toRaw(), ...data }))
    }
  }

  return {
    cases, selectedCase, selectedIndex, filters, pagination,
    specialistWorkloads,
    loading, loadingMore, loadingDetail, assigning, listError, detailError, actionError,
    showDetailModal, showCreateModal,
    caseCount, hasMore, workloadsByLevel, hasPrev, hasNext,
    autopilotState,
    // Cargas view state
    allWorkloads, loadingAllWorkloads,
    cargasSpecialistId, cargasCases, loadingCargasCases,
    loadCases, loadPage, loadCaseById,
    openDetail, openDetailById, closeDetail, goToPrev, goToNext,
    createCase, updateCase, updateCaseStatus,
    assignWdd, assignManual, reassign, triggerAutopilot,
    loadWorkloads, loadAllWorkloads, loadCargasCases,
    onCaseCreatedRT, onCaseAssignedRT, onCaseReassignedRT, onCaseUpdatedRT,
    onAutopilotStartedRT, onAutopilotProgressRT, onAutopilotCompletedRT,
  }
})

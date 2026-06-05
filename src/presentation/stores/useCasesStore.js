import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SyncEngine } from '@/infrastructure/sync/SyncEngine'
import { fetchCasesUseCase } from '@/application/use-cases/cases/FetchCasesUseCase'
import { fetchCaseByIdUseCase } from '@/application/use-cases/cases/FetchCaseByIdUseCase'
import { createCaseUseCase } from '@/application/use-cases/cases/CreateCaseUseCase'
import { updateCaseUseCase } from '@/application/use-cases/cases/UpdateCaseUseCase'
import { updateCaseStatusUseCase } from '@/application/use-cases/cases/UpdateCaseStatusUseCase'
import { assignCaseWddUseCase } from '@/application/use-cases/cases/AssignCaseWddUseCase'
import { assignCaseManualUseCase } from '@/application/use-cases/cases/AssignCaseManualUseCase'
import { reassignCaseUseCase } from '@/application/use-cases/cases/ReassignCaseUseCase'
import { fetchSpecialistWorkloadsUseCase } from '@/application/use-cases/cases/FetchSpecialistWorkloadsUseCase'
import { Case } from '@/domain/entities/Case'
import { useUserStore } from '@/presentation/stores/useUserStore'

const casesSync = new SyncEngine({
  cacheKey: 'tyflow_cases_v1',
  hydrate: (raw) => new Case(raw),
  fetchRemote: null, // set dynamically per-filter
  getId: (item) => item.id,
})

export const useCasesStore = defineStore('cases', () => {
  // ── State ──
  const cases = ref(casesSync.loadFromCache())
  const selectedCase = ref(null)
  const selectedIndex = ref(-1)
  const filters = ref({
    status: 'open',
    originType: null,
    priority: null,
    applicationId: null,
    specialistId: null,
  })
  const pagination = ref({ page: 1, pageSize: 50, total: 0 })
  const specialistWorkloads = ref([])
  const loading = ref(false)
  const loadingDetail = ref(false)
  const assigning = ref(false)
  const listError = ref(null)
  const detailError = ref(null)
  const actionError = ref(null)

  // ── Modal state ──
  const showDetailModal = ref(false)
  const showCreateModal = ref(false)

  // ── Computed ──
  const caseCount = computed(() => pagination.value.total)

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
      Object.assign(filters.value, newFilters)
      pagination.value.page = 1
    }
    // Only show spinner on empty state; cached data stays visible during revalidation
    const isFirstLoad = cases.value.length === 0
    if (isFirstLoad) loading.value = true
    listError.value = null
    try {
      const result = await fetchCasesUseCase({
        ...filters.value,
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
      })
      casesSync.replaceAll(cases, result.data)
      pagination.value.total = result.total
      pagination.value.page = result.page
    } catch (e) {
      listError.value = _humanizeError(e) || 'Error cargando casos'
    } finally {
      loading.value = false
    }
  }

  async function loadPage(page) {
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
      selectedCase.value = await fetchCaseByIdUseCase(id)
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
        cases.value.unshift(created)
        casesSync.writeToCache(cases.value)
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
          cases.value.splice(idx, 1)
          casesSync.writeToCache(cases.value)
          pagination.value.total--
        } else {
          casesSync.updateLocal(cases, id, updated)
        }
      }
      if (selectedCase.value?.id === id) selectedCase.value = updated
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
        cases.value = cases.value.filter(c => c.id !== payload.caseId)
        casesSync.writeToCache(cases.value)
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
        cases.value = cases.value.filter(c => c.id !== payload.caseId)
        casesSync.writeToCache(cases.value)
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

  const _workloadCache = new Map()

  async function loadWorkloads(applicationId) {
    // Serve from cache instantly, then revalidate
    const cached = _workloadCache.get(applicationId)
    if (cached) specialistWorkloads.value = cached
    try {
      const fresh = await fetchSpecialistWorkloadsUseCase(applicationId)
      specialistWorkloads.value = fresh
      _workloadCache.set(applicationId, fresh)
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
      cases.value.unshift(c)
      casesSync.writeToCache(cases.value)
      pagination.value.total++
    }
  }

  function onCaseAssignedRT(data) {
    const idx = cases.value.findIndex(c => c.id === data.case_id)
    let removedFromList = false
    if (idx !== -1) {
      if (filters.value.status === 'open') {
        cases.value.splice(idx, 1)
        casesSync.writeToCache(cases.value)
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
    const w = specialistWorkloads.value.find(s => s.specialist_id === data.specialist_id)
    if (w) w.current_count = (w.current_count ?? 0) + 1
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
    const fromW = specialistWorkloads.value.find(s => s.specialist_id === data.from_specialist_id)
    if (fromW && fromW.current_count > 0) fromW.current_count--
    const toW = specialistWorkloads.value.find(s => s.specialist_id === data.to_specialist_id)
    if (toW) toW.current_count = (toW.current_count ?? 0) + 1
  }

  function onCaseUpdatedRT(data) {
    const idx = cases.value.findIndex(c => c.id === data.case_id)
    let removedFromList = false
    if (idx !== -1) {
      const merged = new Case({ ...cases.value[idx]._toRaw(), ...data })
      if (!_matchesFilters(merged)) {
        cases.value.splice(idx, 1)
        casesSync.writeToCache(cases.value)
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
  }

  return {
    cases, selectedCase, selectedIndex, filters, pagination,
    specialistWorkloads,
    loading, loadingDetail, assigning, listError, detailError, actionError,
    showDetailModal, showCreateModal,
    caseCount, workloadsByLevel, hasPrev, hasNext,
    loadCases, loadPage, loadCaseById,
    openDetail, openDetailById, closeDetail, goToPrev, goToNext,
    createCase, updateCase, updateCaseStatus,
    assignWdd, assignManual, reassign,
    loadWorkloads,
    onCaseCreatedRT, onCaseAssignedRT, onCaseReassignedRT, onCaseUpdatedRT,
  }
})

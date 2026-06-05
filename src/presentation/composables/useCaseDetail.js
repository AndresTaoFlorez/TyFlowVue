import { ref, computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { STATUS_LABELS, STATUS_TRANSITIONS } from '@/domain/entities/Case'
import { fmtDateTime } from '@/presentation/helpers/formatDate'

/**
 * Shared logic for CaseDetailModal and CaseDetailView.
 * Provides status options, computed lookups, changeStatus, and fmtDate.
 *
 * @param {import('vue').ComputedRef<Case|null>} caseRef - computed ref to the selected case
 */
export function useCaseDetail(caseRef) {
  const store = useCasesStore()
  const userStore = useUserStore()

  const assignMode = ref(null) // null | 'wdd' | 'manual'
  const showReassign = ref(false)

  const statusOptions = computed(() => {
    const current = caseRef.value?.status
    if (!current) return []
    return [current, ...(STATUS_TRANSITIONS[current] ?? [])]
  })
  const statusLabels = STATUS_LABELS

  const specialistName = computed(() => {
    if (!caseRef.value?.specialistId) return null
    const s = store.specialistWorkloads.find(w => w.specialist_id === caseRef.value.specialistId)
    return s?.full_name ?? caseRef.value.specialistId.slice(0, 8)
  })

  const applicationName = computed(() => {
    if (!caseRef.value?.applicationId) return null
    const app = userStore.applications.find(a => a.id === caseRef.value.applicationId)
    return app?.name ?? caseRef.value.applicationId.slice(0, 8)
  })

  const supportLevelName = computed(() => {
    if (!caseRef.value?.supportLevelId) return null
    const lvl = userStore.supportLevels.find(sl => sl.id === caseRef.value.supportLevelId)
    return lvl?.name ?? caseRef.value.supportLevelId.slice(0, 8)
  })

  const categoryName = computed(() => {
    if (!caseRef.value?.supportCategoryId) return null
    const cat = userStore.supportCategories.find(sc => sc.id === caseRef.value.supportCategoryId)
    return cat?.name ?? caseRef.value.supportCategoryId.slice(0, 8)
  })

  async function changeStatus(newStatus) {
    await store.updateCaseStatus(caseRef.value.id, newStatus)
  }

  function toggleAssign(mode) {
    assignMode.value = assignMode.value === mode ? null : mode
  }

  function onAssignDone() {
    assignMode.value = null
    if (caseRef.value) store.loadCaseById(caseRef.value.id)
  }

  function onReassignDone() {
    showReassign.value = false
    if (caseRef.value) store.loadCaseById(caseRef.value.id)
  }

  return {
    assignMode,
    toggleAssign,
    showReassign,
    statusOptions,
    statusLabels,
    applicationName,
    supportLevelName,
    specialistName,
    categoryName,
    changeStatus,
    fmtDate: fmtDateTime,
    onAssignDone,
    onReassignDone,
  }
}

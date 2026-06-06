import { ref, computed, watch } from 'vue'
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

  const showAssign = ref(false)
  const showReassign = ref(false)

  // Collapse assign/reassign panels whenever the active case changes
  watch(() => caseRef.value?.id, () => {
    showAssign.value = false
    showReassign.value = false
  })

  const statusOptions = computed(() => {
    const current = caseRef.value?.status
    if (!current) return []
    return [current, ...(STATUS_TRANSITIONS[current] ?? [])]
  })
  const statusLabels = STATUS_LABELS

  const specialistName = computed(() => {
    if (!caseRef.value?.specialistId) return null
    const sid = caseRef.value.specialistId
    const w = store.specialistWorkloads.find(s => s.specialist_id === sid)
    if (w?.full_name) return w.full_name
    const u = userStore.users.find(u => u.specialistId === sid)
    return u?.fullName ?? null
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

  function toggleAssign() {
    showAssign.value = !showAssign.value
  }

  function onAssignDone() {
    showAssign.value = false
    if (caseRef.value) store.loadCaseById(caseRef.value.id)
  }

  function onReassignDone() {
    showReassign.value = false
    if (caseRef.value) store.loadCaseById(caseRef.value.id)
  }

  return {
    showAssign,
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

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchPendingCasesUseCase } from '@/application/use-cases/cases/FetchPendingCasesUseCase'
import { createCaseUseCase } from '@/application/use-cases/cases/CreateCaseUseCase'
import { manualAssignUseCase } from '@/application/use-cases/cases/ManualAssignUseCase'
import { fetchRecentAssignmentsUseCase } from '@/application/use-cases/cases/FetchRecentAssignmentsUseCase'
import { fetchSpecialistWorkloadsUseCase } from '@/application/use-cases/cases/FetchSpecialistWorkloadsUseCase'
import { Case } from '@/domain/entities/Case'

export const useCasesStore = defineStore('cases', () => {
  // ── State ──
  const pendingCases = ref([])
  const selectedCase = ref(null)
  const evaluationResult = ref(null)
  const recentAssignments = ref([])
  const specialistWorkloads = ref([])
  const loading = ref(false)
  const assigning = ref(false)
  const error = ref(null)

  // ── Computed ──
  const pendingCount = computed(() => pendingCases.value.length)

  // Group workloads by support level for display
  const workloadsByLevel = computed(() => {
    const groups = {}
    for (const w of specialistWorkloads.value) {
      // Backend returns flat list; group by a level key if available
      const lvl = w.support_level_name ?? 'General'
      if (!groups[lvl]) groups[lvl] = []
      groups[lvl].push(w)
    }
    return groups
  })

  // ── Actions ──
  async function loadPendingCases(filters = {}) {
    loading.value = true
    error.value = null
    try {
      const result = await fetchPendingCasesUseCase(filters)
      pendingCases.value = result.data
    } catch (e) {
      error.value = e?.response?.data?.detail ?? e.message ?? 'Error cargando casos'
    } finally {
      loading.value = false
    }
  }

  async function loadRecentAssignments() {
    try {
      recentAssignments.value = await fetchRecentAssignmentsUseCase(15)
    } catch { /* silent */ }
  }

  async function loadWorkloads(applicationId) {
    try {
      specialistWorkloads.value = await fetchSpecialistWorkloadsUseCase(applicationId)
    } catch { /* silent */ }
  }

  function selectCase(c) {
    selectedCase.value = c
    evaluationResult.value = null
  }

  /**
   * Crear caso con WDD automático (trigger_wdd: true).
   * Retorna { conversation, assignmentId, wddError }
   */
  async function createAndAutoAssign(payload) {
    assigning.value = true
    evaluationResult.value = null
    error.value = null
    try {
      const result = await createCaseUseCase({ ...payload, triggerWdd: true })
      evaluationResult.value = result
      if (result.assignmentId) {
        pendingCases.value = pendingCases.value.filter(c => c.id !== result.conversation?.id)
      }
      return result
    } catch (e) {
      error.value = e?.response?.data?.detail ?? e.message
      throw e
    } finally {
      assigning.value = false
    }
  }

  /**
   * Crear caso sin asignar (trigger_wdd: false).
   */
  async function createWithoutAssign(payload) {
    assigning.value = true
    error.value = null
    try {
      const result = await createCaseUseCase({ ...payload, triggerWdd: false })
      if (result.conversation) {
        pendingCases.value.unshift(result.conversation)
      }
      return result
    } catch (e) {
      error.value = e?.response?.data?.detail ?? e.message
      throw e
    } finally {
      assigning.value = false
    }
  }

  /**
   * Asignación manual de un caso a un especialista.
   */
  async function manualAssign({ conversationId, specialistId, workWindowId }) {
    assigning.value = true
    error.value = null
    try {
      const result = await manualAssignUseCase({ conversationId, specialistId, workWindowId })
      pendingCases.value = pendingCases.value.filter(c => c.id !== conversationId)
      return result
    } catch (e) {
      error.value = e?.response?.data?.detail ?? e.message
      throw e
    } finally {
      assigning.value = false
    }
  }

  // ── Realtime mutations (called from useCasesRealtime composable) ──
  function onCaseCreatedRT(raw) {
    const c = new Case(raw)
    if (!pendingCases.value.find(x => x.id === c.id)) {
      pendingCases.value.unshift(c)
    }
  }

  function onAssignmentCreatedRT(data) {
    pendingCases.value = pendingCases.value.filter(c => c.id !== data.conversation_id)
    recentAssignments.value = [data, ...recentAssignments.value].slice(0, 15)
    if (selectedCase.value?.id === data.conversation_id) {
      evaluationResult.value = {
        assignmentId: data.assignment_id,
        conversation: selectedCase.value,
        wddError: null,
      }
    }
    const w = specialistWorkloads.value.find(s => s.specialist_id === data.specialist_id)
    if (w) w.current_count = (w.current_count ?? 0) + 1
  }

  return {
    pendingCases, selectedCase, evaluationResult,
    recentAssignments, specialistWorkloads,
    loading, assigning, error,
    pendingCount, workloadsByLevel,
    loadPendingCases, loadRecentAssignments, loadWorkloads,
    selectCase, createAndAutoAssign, createWithoutAssign, manualAssign,
    onCaseCreatedRT, onAssignmentCreatedRT,
  }
})

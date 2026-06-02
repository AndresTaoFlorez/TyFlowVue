import client from '@/infrastructure/http/client'
import { Case } from '@/domain/entities/Case'
import { Assignment } from '@/domain/entities/Assignment'

export const CaseRepository = {
  /**
   * Casos pendientes (sin asignación activa).
   * Backend: GET /conversations?pending_only=true
   */
  async fetchPending({ applicationId, supportLevelId, page = 1, pageSize = 50 } = {}) {
    const params = { pending_only: true, page, page_size: pageSize }
    if (applicationId) params.application_id = applicationId
    if (supportLevelId) params.support_level_id = supportLevelId
    const { data } = await client.get('/conversations', { params })
    return {
      data: (data.data ?? []).map(c => new Case(c)),
      total: data.total ?? 0,
    }
  },

  /**
   * Crear caso(s) y opcionalmente disparar WDD.
   * Backend: POST /conversations
   */
  async ingest({ subject, body, fromAddress, folderId, tags = [], triggerWdd = false }) {
    const { data } = await client.post('/conversations', {
      conversations: [{
        folder_id: folderId,
        subject,
        body: body ?? '',
        from_address: fromAddress ?? '',
        tags,
      }],
      trigger_wdd: triggerWdd,
    })
    const result = data.results?.[0]
    return {
      conversation: result?.conversation ? new Case(result.conversation) : null,
      assignmentId: result?.assignment_id ?? null,
      wddError: result?.wdd_error ?? null,
      created: data.created ?? 0,
      assigned: data.assigned ?? 0,
    }
  },

  /**
   * Asignaciones recientes (enriquecidas con nombre de especialista y asunto).
   * Backend: GET /assignments/recent?limit=N
   */
  async fetchRecentAssignments(limit = 10) {
    const { data } = await client.get('/assignments/recent', { params: { limit } })
    return Array.isArray(data) ? data : data.data ?? []
  },

  /**
   * Cargas de especialistas por aplicación.
   * Backend: GET /specialists/workload?application_id=X
   */
  async fetchWorkloads(applicationId) {
    const { data } = await client.get('/specialists/workload', {
      params: { application_id: applicationId },
    })
    return Array.isArray(data) ? data : data.data ?? []
  },

  /**
   * Asignación manual.
   * Backend: POST /assignments/manual
   */
  async manualAssign({ conversationId, specialistId, workWindowId, reason = 'reassignment_same_level' }) {
    const { data } = await client.post('/assignments/manual', {
      conversation_id: conversationId,
      specialist_id: specialistId,
      work_window_id: workWindowId ?? null,
      reason,
    })
    return data
  },

  /**
   * WDD automático para un caso existente.
   * Backend: POST /assignments/wdd
   */
  async wddAssign({ conversationId, applicationId, supportLevelId }) {
    const { data } = await client.post('/assignments/wdd', {
      conversation_id: conversationId,
      application_id: applicationId,
      support_level_id: supportLevelId,
    })
    return data
  },

  /**
   * Lista de asignaciones con filtros.
   * Backend: GET /assignments
   */
  async fetchAssignments({ specialistId, activeOnly = true, page = 1, pageSize = 100 } = {}) {
    const params = { active_only: activeOnly, page, page_size: pageSize }
    if (specialistId) params.specialist_id = specialistId
    const { data } = await client.get('/assignments', { params })
    const items = data.data ?? (Array.isArray(data) ? data : [])
    return items.map(a => new Assignment(a))
  },
}

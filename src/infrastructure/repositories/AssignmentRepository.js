import client from '@/infrastructure/http/client'
import { Assignment } from '@/domain/entities/Assignment'

export const AssignmentRepository = {
  /**
   * Paginated assignment list with optional filters.
   * Returns { data, total, page, pageSize } from the backend envelope.
   */
  async fetchAll({ specialistId, caseId, activeOnly, page, pageSize } = {}) {
    const params = {}
    if (specialistId) params.specialist_id = specialistId
    if (caseId) params.case_id = caseId
    if (activeOnly) params.active_only = true
    if (page) params.page = page
    if (pageSize) params.page_size = pageSize

    const { data } = await client.get('/assignments', { params })
    const items = Array.isArray(data) ? data : data.items ?? data.data ?? []
    return {
      data: items.map((item) => new Assignment(item)),
      total: data.total ?? items.length,
      page: data.page ?? page ?? 1,
      pageSize: data.page_size ?? pageSize ?? 100,
    }
  },

  async fetchByCase(caseId) {
    const { data } = await client.get('/assignments', {
      params: { case_id: caseId },
    })
    const items = Array.isArray(data) ? data : data.items ?? data.data ?? []
    return items.map((item) => new Assignment(item))
  },

  /**
   * Returns the total historical assignment count for a specialist.
   * Uses page_size=1 — we only need `total` from the envelope.
   */
  async fetchTotalBySpecialist(specialistId) {
    const { data } = await client.get('/assignments', {
      params: { specialist_id: specialistId, page: 1, page_size: 1 },
    })
    return data.total ?? 0
  },
}

import client from '@/infrastructure/http/client'
import { Assignment } from '@/domain/entities/Assignment'

export const AssignmentRepository = {
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

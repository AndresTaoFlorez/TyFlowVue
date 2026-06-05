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
}

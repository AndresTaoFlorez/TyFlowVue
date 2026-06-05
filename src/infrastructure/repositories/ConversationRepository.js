import client from '@/infrastructure/http/client'
import { Conversation } from '@/domain/entities/Conversation'

export const ConversationRepository = {
  async fetchAll({ folderId, applicationId, supportLevelId, page = 1, pageSize = 100 } = {}) {
    const params = { page, page_size: pageSize }
    if (folderId) params.folder_id = folderId
    if (applicationId) params.application_id = applicationId
    if (supportLevelId) params.support_level_id = supportLevelId

    const { data } = await client.get('/conversations', { params })
    return {
      data: (data.items || data.data || []).map((item) => new Conversation(item)),
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
    }
  },

  async fetchById(id) {
    const { data } = await client.get(`/conversations/${id}`)
    return new Conversation(data)
  },

  async ingest({ conversations, triggerWdd = false }) {
    const { data } = await client.post('/conversations', {
      conversations,
      trigger_wdd: triggerWdd,
    })
    return {
      created: data.created,
      assigned: data.assigned,
      failedAssignments: data.failed_assignments,
      results: (data.results || []).map((r) => ({
        conversation: new Conversation(r.conversation),
        assignmentId: r.assignment_id,
        wddError: r.wdd_error,
      })),
    }
  },
}

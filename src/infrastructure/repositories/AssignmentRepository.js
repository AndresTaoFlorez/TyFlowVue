import client from '@/infrastructure/http/client'
import { Assignment } from '@/domain/entities/Assignment'

export const AssignmentRepository = {
  async fetchByConversation(conversationId) {
    const { data } = await client.get('/assignments', {
      params: { conversation_id: conversationId },
    })
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new Assignment(item))
  },
}

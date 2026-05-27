import { ConversationRepository } from '@/infrastructure/repositories/ConversationRepository'

export async function fetchConversationsUseCase(filters = {}) {
  return ConversationRepository.fetchAll(filters)
}

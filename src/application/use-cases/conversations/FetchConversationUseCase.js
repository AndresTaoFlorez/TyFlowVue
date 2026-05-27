import { ConversationRepository } from '@/infrastructure/repositories/ConversationRepository'

export async function fetchConversationUseCase(id) {
  return ConversationRepository.fetchById(id)
}

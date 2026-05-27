import { AssignmentRepository } from '@/infrastructure/repositories/AssignmentRepository'

export async function fetchAssignmentsByConversationUseCase(conversationId) {
  return AssignmentRepository.fetchByConversation(conversationId)
}

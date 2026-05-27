import { DomainError } from '@/domain/errors/DomainErrors'
import { ConversationRepository } from '@/infrastructure/repositories/ConversationRepository'

export async function ingestConversationsUseCase({ conversations, triggerWdd = false }) {
  if (!conversations || conversations.length === 0) {
    throw new DomainError('Debe incluir al menos una conversacion.')
  }
  if (conversations.length > 500) {
    throw new DomainError('Maximo 500 conversaciones por lote.')
  }
  for (const c of conversations) {
    if (!c.folder_id) {
      throw new DomainError('Cada conversacion requiere un folder_id.')
    }
  }
  return ConversationRepository.ingest({ conversations, triggerWdd })
}

import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function manualAssignUseCase({ conversationId, specialistId, workWindowId }) {
  return CaseRepository.manualAssign({ conversationId, specialistId, workWindowId })
}

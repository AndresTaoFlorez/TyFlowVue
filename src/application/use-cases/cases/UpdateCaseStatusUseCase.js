import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function updateCaseStatusUseCase(id, status) {
  return CaseRepository.updateStatus(id, status)
}

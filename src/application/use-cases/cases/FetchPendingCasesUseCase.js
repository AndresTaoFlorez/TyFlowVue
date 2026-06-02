import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function fetchPendingCasesUseCase(filters = {}) {
  return CaseRepository.fetchPending(filters)
}

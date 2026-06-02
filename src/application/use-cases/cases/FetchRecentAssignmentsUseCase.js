import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function fetchRecentAssignmentsUseCase(limit = 10) {
  return CaseRepository.fetchRecentAssignments(limit)
}

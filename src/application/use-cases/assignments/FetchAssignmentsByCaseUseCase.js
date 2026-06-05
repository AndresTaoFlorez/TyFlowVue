import { AssignmentRepository } from '@/infrastructure/repositories/AssignmentRepository'

export async function fetchAssignmentsByCaseUseCase(caseId) {
  return AssignmentRepository.fetchByCase(caseId)
}

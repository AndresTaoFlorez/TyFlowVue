import { AssignmentRepository } from '@/infrastructure/repositories/AssignmentRepository'

export async function fetchAssignmentTotalUseCase(specialistId) {
  return AssignmentRepository.fetchTotalBySpecialist(specialistId)
}

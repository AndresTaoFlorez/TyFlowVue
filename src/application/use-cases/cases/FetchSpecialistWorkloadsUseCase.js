import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function fetchSpecialistWorkloadsUseCase(applicationId) {
  return CaseRepository.fetchWorkloads(applicationId)
}

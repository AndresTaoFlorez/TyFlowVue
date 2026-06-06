import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function fetchSpecialistWorkloadsUseCase(applicationId, options = {}) {
  return CaseRepository.fetchWorkloads(applicationId, options)
}

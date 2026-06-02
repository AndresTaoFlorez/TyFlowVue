import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function reassignCaseUseCase(payload) {
  return CaseRepository.reassign(payload)
}

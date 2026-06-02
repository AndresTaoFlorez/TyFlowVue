import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function createCaseUseCase(payload) {
  return CaseRepository.create(payload)
}

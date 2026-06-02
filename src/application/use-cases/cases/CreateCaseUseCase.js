import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function createCaseUseCase(payload) {
  return CaseRepository.ingest(payload)
}

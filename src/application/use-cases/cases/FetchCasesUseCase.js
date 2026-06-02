import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function fetchCasesUseCase(filters) {
  return CaseRepository.fetchAll(filters)
}

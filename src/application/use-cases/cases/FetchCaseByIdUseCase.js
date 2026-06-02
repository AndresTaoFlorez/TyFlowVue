import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function fetchCaseByIdUseCase(id) {
  return CaseRepository.fetchById(id)
}

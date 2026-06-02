import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function updateCaseUseCase(id, fields) {
  return CaseRepository.update(id, fields)
}

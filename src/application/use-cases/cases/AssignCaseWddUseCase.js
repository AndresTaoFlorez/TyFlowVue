import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function assignCaseWddUseCase(payload) {
  return CaseRepository.assignWdd(payload)
}

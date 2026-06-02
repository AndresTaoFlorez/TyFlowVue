import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function assignCaseManualUseCase(payload) {
  return CaseRepository.assignManual(payload)
}

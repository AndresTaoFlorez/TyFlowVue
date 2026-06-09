import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function assignCaseWddAutopilotUseCase(filters = {}) {
  return CaseRepository.autopilotWdd(filters)
}

import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

export async function assignCaseWddAutopilotUseCase() {
  return CaseRepository.autopilotWdd()
}

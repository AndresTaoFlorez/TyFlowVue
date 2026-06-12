import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

/** Solicita la detención graciosa del job de autopilot en curso. */
export async function stopAutopilotUseCase() {
  return CaseRepository.autopilotStop()
}

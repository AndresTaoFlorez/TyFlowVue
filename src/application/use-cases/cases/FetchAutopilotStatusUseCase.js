import { CaseRepository } from '@/infrastructure/repositories/CaseRepository'

/** Snapshot del job de autopilot — para resincronizar tras recarga/reconexión. */
export async function fetchAutopilotStatusUseCase() {
  return CaseRepository.autopilotStatus()
}

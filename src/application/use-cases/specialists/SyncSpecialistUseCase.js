import { SpecialistRepository } from '@/infrastructure/repositories/SpecialistRepository'

export async function syncSpecialistUseCase({ specialistId, selectedSupportLevelIds }) {
  if (!specialistId) return
  await SpecialistRepository.syncSupportLevels(specialistId, selectedSupportLevelIds)
}

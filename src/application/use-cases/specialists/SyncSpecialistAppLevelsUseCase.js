import { SpecialistRepository } from '@/infrastructure/repositories/SpecialistRepository'

export async function syncSpecialistAppLevelsUseCase(specialistId, entries) {
  return SpecialistRepository.syncAppLevels(specialistId, entries)
}

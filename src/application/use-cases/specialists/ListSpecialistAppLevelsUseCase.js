import { SpecialistRepository } from '@/infrastructure/repositories/SpecialistRepository'

export async function listSpecialistAppLevelsUseCase(specialistId) {
  return SpecialistRepository.fetchAppLevels(specialistId)
}

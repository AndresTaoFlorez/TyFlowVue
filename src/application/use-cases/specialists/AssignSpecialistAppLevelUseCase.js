import { SpecialistRepository } from '@/infrastructure/repositories/SpecialistRepository'

export async function assignSpecialistAppLevelUseCase(specialistId, applicationId, supportLevelId) {
  return SpecialistRepository.assignAppLevel(specialistId, applicationId, supportLevelId)
}

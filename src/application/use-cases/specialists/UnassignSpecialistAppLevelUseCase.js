import { SpecialistRepository } from '@/infrastructure/repositories/SpecialistRepository'

export async function unassignSpecialistAppLevelUseCase(recordId) {
  return SpecialistRepository.removeAppLevel(recordId)
}

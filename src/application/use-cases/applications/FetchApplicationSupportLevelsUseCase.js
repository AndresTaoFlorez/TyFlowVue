import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'

export async function fetchApplicationSupportLevelsUseCase(applicationId) {
  return ApplicationRepository.fetchSupportLevels(applicationId)
}

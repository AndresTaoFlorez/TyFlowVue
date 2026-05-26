import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'

export async function updateApplicationUseCase(applicationId, payload) {
  return ApplicationRepository.update(applicationId, payload)
}

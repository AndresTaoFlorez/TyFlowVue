import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'

export async function deleteApplicationUseCase(applicationId) {
  return ApplicationRepository.delete(applicationId)
}

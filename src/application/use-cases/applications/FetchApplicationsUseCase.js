import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'

export async function fetchApplicationsUseCase() {
  return ApplicationRepository.fetchAll()
}

import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'

export async function fetchAppSpecialistsUseCase(applicationId) {
  return ApplicationRepository.fetchSpecialists(applicationId)
}

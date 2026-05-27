import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function fetchApplicationSpecialistsUseCase(applicationId) {
  return UserRepository.fetchByApplication(applicationId)
}

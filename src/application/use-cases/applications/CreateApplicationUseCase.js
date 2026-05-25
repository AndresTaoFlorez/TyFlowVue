import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'

export async function createApplicationUseCase(name) {
  return ApplicationRepository.create(name)
}

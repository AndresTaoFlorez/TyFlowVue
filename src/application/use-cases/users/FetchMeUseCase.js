import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function fetchMeUseCase() {
  return UserRepository.fetchMe()
}

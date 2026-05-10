import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function fetchUserByIdUseCase(userId) {
  return UserRepository.fetchById(userId)
}

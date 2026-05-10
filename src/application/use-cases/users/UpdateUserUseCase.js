import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateUserUseCase(userId, data) {
  return UserRepository.update(userId, data)
}

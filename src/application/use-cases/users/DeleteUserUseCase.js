import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function deleteUserUseCase(userId) {
  return UserRepository.delete(userId)
}

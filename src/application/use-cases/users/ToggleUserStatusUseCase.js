import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function toggleUserStatusUseCase(userId) {
  return UserRepository.toggleStatus(userId)
}

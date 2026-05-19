import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function toggleUserStatusUseCase(userId, isActive) {
  return UserRepository.toggleStatus(userId, isActive)
}

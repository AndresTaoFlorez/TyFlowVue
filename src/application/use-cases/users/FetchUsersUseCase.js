import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function fetchUsersUseCase() {
  return UserRepository.fetchAll()
}

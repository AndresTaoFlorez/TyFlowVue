import { RoleRepository } from '@/infrastructure/repositories/RoleRepository'

export async function fetchRolesUseCase() {
  return RoleRepository.fetchAll()
}

import { RoleRepository } from '@/infrastructure/repositories/RoleRepository'

export async function createRoleUseCase({ name }) {
  return RoleRepository.create({ name })
}

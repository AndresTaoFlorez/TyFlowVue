import { RoleRepository } from '@/infrastructure/repositories/RoleRepository'

export async function deleteRoleUseCase(roleId) {
  return RoleRepository.delete(roleId)
}

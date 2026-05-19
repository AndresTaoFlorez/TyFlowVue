import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateUserUseCase(userId, { firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleIds, supportLevelIds }, { emailChanged = false } = {}) {
  // El backend: campo omitido = preservar, [] = borrar todos.
  // NUNCA enviar role_ids/support_level_ids como array vacío.
  const payload = {}

  if (firstName) payload.first_name = firstName
  if (secondName != null) payload.second_name = secondName || null
  if (firstSurname) payload.first_surname = firstSurname
  if (secondSurname != null) payload.second_surname = secondSurname || null
  if (documentNumber) payload.id_document = documentNumber
  if (emailChanged) payload.email = email

  if (Array.isArray(roleIds) && roleIds.length > 0) payload.role_ids = roleIds
  if (Array.isArray(supportLevelIds) && supportLevelIds.length > 0) payload.support_level_ids = supportLevelIds

  return UserRepository.update(userId, payload)
}

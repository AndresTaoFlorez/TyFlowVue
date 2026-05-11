import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateUserUseCase(userId, { firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleIds, areaIds }, { emailChanged = false } = {}) {
  // El backend: campo omitido = preservar, [] = borrar todos.
  // NUNCA enviar role_ids/area_ids como array vacío.
  const payload = {}

  if (firstName) payload.first_name = firstName
  if (secondName) payload.second_name = secondName
  if (firstSurname) payload.first_surname = firstSurname
  if (secondSurname) payload.second_surname = secondSurname
  if (documentNumber) payload.id_document = documentNumber
  if (emailChanged) payload.email = email

  if (Array.isArray(roleIds) && roleIds.length > 0) payload.role_ids = roleIds
  if (Array.isArray(areaIds) && areaIds.length > 0) payload.area_ids = areaIds

  return UserRepository.update(userId, payload)
}

import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateUserUseCase(userId, { firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleIds }, { emailChanged = false } = {}) {
  // El backend: campo omitido = preservar, [] = borrar todos.
  const payload = {}

  if (firstName) payload.first_name = firstName
  if (secondName != null) payload.second_name = secondName || null
  if (firstSurname) payload.first_surname = firstSurname
  if (secondSurname != null) payload.second_surname = secondSurname || null
  if (documentNumber) payload.id_document = documentNumber
  if (emailChanged) payload.email = email

  if (Array.isArray(roleIds)) payload.role_ids = roleIds

  return UserRepository.update(userId, payload)
}

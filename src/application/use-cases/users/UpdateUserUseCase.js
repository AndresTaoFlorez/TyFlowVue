import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateUserUseCase(userId, { firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleIds, supportLevelIds, applicationIds }, { emailChanged = false } = {}) {
  const payload = {
    first_name: firstName || null,
    second_name: secondName || null,
    first_surname: firstSurname || null,
    second_surname: secondSurname || null,
    id_document: documentNumber || null,
  }

  if (emailChanged) payload.email = email
  if (Array.isArray(roleIds)) payload.role_ids = roleIds
  if (Array.isArray(supportLevelIds)) payload.support_level_ids = supportLevelIds
  if (Array.isArray(applicationIds)) payload.application_ids = applicationIds

  return UserRepository.update(userId, payload)
}

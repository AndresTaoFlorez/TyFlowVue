import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateMeUseCase({ firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleIds, supportLevelIds }, { emailChanged = false } = {}) {
  const payload = {
    first_name: firstName,
    first_surname: firstSurname,
    id_document: documentNumber,
    second_name: secondName,
    second_surname: secondSurname,
  }

  if (emailChanged) payload.email = email

  if (Array.isArray(roleIds)) payload.role_ids = roleIds
  if (Array.isArray(supportLevelIds)) payload.support_level_ids = supportLevelIds

  return UserRepository.updateMe(payload)
}

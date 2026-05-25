import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function createUserUseCase({ firstName, firstSurname, documentNumber, secondName, secondSurname, email, password, roleIds, supportLevelIds, applicationIds }) {
  const payload = {
    first_name: firstName,
    first_surname: firstSurname,
    id_document: documentNumber,
    second_name: secondName || undefined,
    second_surname: secondSurname || undefined,
    email,
    password,
    role_ids: roleIds,
  }

  if (Array.isArray(supportLevelIds) && supportLevelIds.length) payload.support_level_ids = supportLevelIds
  if (Array.isArray(applicationIds) && applicationIds.length) payload.application_ids = applicationIds

  return UserRepository.create(payload)
}

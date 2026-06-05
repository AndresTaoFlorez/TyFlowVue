import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function createUserUseCase({ firstName, firstSurname, documentNumber, secondName, secondSurname, email, password, roleIds, applicationLevels, supportLevelIds, applicationIds }) {
  const payload = {
    first_name: firstName,
    first_surname: firstSurname,
    id_document: documentNumber,
    second_name: secondName || null,
    second_surname: secondSurname || null,
    email,
    password,
    role_ids: roleIds,
  }

  // Prefer explicit applicationLevels pairs; fall back to cross-product of old separate arrays
  if (Array.isArray(applicationLevels) && applicationLevels.length) {
    payload.application_levels = applicationLevels.map(al => ({
      application_id: al.applicationId ?? al.application_id,
      support_level_id: al.supportLevelId ?? al.support_level_id,
    }))
  } else if (Array.isArray(applicationIds) && applicationIds.length && Array.isArray(supportLevelIds) && supportLevelIds.length) {
    payload.application_levels = applicationIds.flatMap(appId =>
      supportLevelIds.map(lvlId => ({ application_id: appId, support_level_id: lvlId }))
    )
  }

  return UserRepository.create(payload)
}

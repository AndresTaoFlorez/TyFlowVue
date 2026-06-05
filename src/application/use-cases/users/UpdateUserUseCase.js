import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateUserUseCase(userId, { firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleIds, applicationLevels, supportLevelIds, applicationIds }, { emailChanged = false } = {}) {
  const payload = {
    first_name: firstName || null,
    second_name: secondName || null,
    first_surname: firstSurname || null,
    second_surname: secondSurname || null,
    id_document: documentNumber || null,
  }

  if (emailChanged) payload.email = email
  if (Array.isArray(roleIds)) payload.role_ids = roleIds

  // Prefer explicit applicationLevels pairs; fall back to cross-product of old separate arrays
  if (Array.isArray(applicationLevels)) {
    payload.application_levels = applicationLevels.map(al => ({
      application_id: al.applicationId ?? al.application_id,
      support_level_id: al.supportLevelId ?? al.support_level_id,
    }))
  } else if (Array.isArray(applicationIds) && Array.isArray(supportLevelIds)) {
    payload.application_levels = applicationIds.flatMap(appId =>
      supportLevelIds.map(lvlId => ({ application_id: appId, support_level_id: lvlId }))
    )
  }

  return UserRepository.update(userId, payload)
}

import { UserRepository } from '@/infrastructure/repositories/UserRepository'
import { buildSpecialistProfile } from './buildSpecialistProfile'

export async function updateUserUseCase(userId, { firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleNames, applicationLevels, categoryAssignments }, { emailChanged = false } = {}) {
  const payload = {
    first_name: firstName || null,
    second_name: secondName || null,
    first_surname: firstSurname || null,
    second_surname: secondSurname || null,
    id_document: documentNumber || null,
  }

  if (emailChanged) payload.email = email
  if (Array.isArray(roleNames)) payload.role_names = roleNames

  const specialistProfile = buildSpecialistProfile(applicationLevels, categoryAssignments)
  if (specialistProfile) payload.specialist_profile = specialistProfile

  return UserRepository.update(userId, payload)
}

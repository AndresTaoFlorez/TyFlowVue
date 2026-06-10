import { UserRepository } from '@/infrastructure/repositories/UserRepository'
import { buildSpecialistProfile } from './buildSpecialistProfile'

export async function createUserUseCase({ firstName, firstSurname, documentNumber, secondName, secondSurname, email, password, roleNames, applicationLevels, categoryAssignments }) {
  const payload = {
    first_name: firstName,
    first_surname: firstSurname,
    id_document: documentNumber,
    second_name: secondName || null,
    second_surname: secondSurname || null,
    email,
    password,
    role_names: Array.isArray(roleNames) ? roleNames : [],
  }

  const specialistProfile = buildSpecialistProfile(applicationLevels, categoryAssignments)
  if (specialistProfile) payload.specialist_profile = specialistProfile

  return UserRepository.create(payload)
}

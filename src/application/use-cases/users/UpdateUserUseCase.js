import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function updateUserUseCase(userId, { firstName, secondName, firstSurname, secondSurname, documentNumber, email, roleIds, areaIds }) {
  return UserRepository.update(userId, {
    first_name: firstName || undefined,
    second_name: secondName || undefined,
    first_surname: firstSurname || undefined,
    second_surname: secondSurname || undefined,
    id_document: documentNumber || undefined,
    email: email || undefined,
    role_ids: roleIds?.length ? roleIds : undefined,
    area_ids: areaIds?.length ? areaIds : undefined,
  })
}

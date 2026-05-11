import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function createUserUseCase({ firstName, firstSurname, documentNumber, secondName, secondSurname, email, password, roleIds, areaIds }) {
  return UserRepository.create({
    first_name: firstName,
    first_surname: firstSurname,
    id_document: documentNumber,
    second_name: secondName || undefined,
    second_surname: secondSurname || undefined,
    email,
    password,
    role_ids: roleIds?.length ? roleIds : undefined,
    area_ids: areaIds?.length ? areaIds : undefined,
  })
}

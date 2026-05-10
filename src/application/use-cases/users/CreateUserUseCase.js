import { UserRepository } from '@/infrastructure/repositories/UserRepository'

export async function createUserUseCase({ firstName, firstSurname, documentNumber, secondName, secondSurname }) {
  return UserRepository.create({
    first_name: firstName,
    first_surname: firstSurname,
    document_number: documentNumber,
    second_name: secondName || undefined,
    second_surname: secondSurname || undefined,
  })
}

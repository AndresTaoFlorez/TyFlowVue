import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'
import { DomainError } from '@/domain/errors/DomainErrors'

export async function createApplicationUseCase(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) {
    throw new DomainError('El nombre de la aplicación no puede estar vacío.')
  }
  if (trimmed.length > 100) {
    throw new DomainError('El nombre no puede exceder 100 caracteres.')
  }
  return ApplicationRepository.create(trimmed)
}

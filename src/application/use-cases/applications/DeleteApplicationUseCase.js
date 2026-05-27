import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'
import { DomainError } from '@/domain/errors/DomainErrors'

export async function deleteApplicationUseCase(applicationId) {
  if (!applicationId) {
    throw new DomainError('Se requiere el ID de la aplicación.')
  }
  try {
    return await ApplicationRepository.delete(applicationId)
  } catch (err) {
    throw new DomainError(
      err.response?.data?.detail || 'Error al eliminar la aplicación.'
    )
  }
}

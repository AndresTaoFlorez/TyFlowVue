import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'
import { DomainError } from '@/domain/errors/DomainErrors'

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export async function updateApplicationUseCase(applicationId, payload) {
  if (!applicationId) {
    throw new DomainError('Se requiere el ID de la aplicación.')
  }
  if (payload.name !== undefined) {
    const trimmed = (payload.name || '').trim()
    if (!trimmed) {
      throw new DomainError('El nombre no puede estar vacío.')
    }
    if (trimmed.length > 100) {
      throw new DomainError('El nombre no puede exceder 100 caracteres.')
    }
  }
  if (payload.theme?.color && !HEX_COLOR_RE.test(payload.theme.color)) {
    throw new DomainError('El color debe ser un valor hexadecimal válido (ej. #2AC78F).')
  }
  return ApplicationRepository.update(applicationId, payload)
}

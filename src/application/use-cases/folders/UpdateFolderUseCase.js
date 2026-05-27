import { FolderRepository } from '@/infrastructure/repositories/FolderRepository'
import { DomainError } from '@/domain/errors/DomainErrors'

export async function updateFolderUseCase(id, { name, isActive, externalId }) {
  if (!id) {
    throw new DomainError('Se requiere el ID de la carpeta.')
  }
  if (name !== undefined) {
    const trimmed = (name || '').trim()
    if (!trimmed) {
      throw new DomainError('El nombre de la carpeta no puede estar vacío.')
    }
  }

  return FolderRepository.update(id, {
    name: name ?? null,
    is_active: isActive ?? null,
    external_id: externalId ?? null,
  })
}

import { FolderRepository } from '@/infrastructure/repositories/FolderRepository'
import { DomainError } from '@/domain/errors/DomainErrors'

export async function createFolderUseCase({ applicationId, type, name, parentFolderId, specialistId, supportLevelId }) {
  const trimmed = (name || '').trim()
  if (!trimmed) {
    throw new DomainError('El nombre de la carpeta no puede estar vacío.')
  }
  if (!applicationId) {
    throw new DomainError('Se requiere el ID de la aplicación.')
  }
  if (!type) {
    throw new DomainError('Se requiere el tipo de carpeta.')
  }
  if (type === 'level' && !supportLevelId) {
    throw new DomainError('Un nivel requiere un SupportLevel asociado.')
  }
  if (type === 'specialist' && parentFolderId && !specialistId) {
    throw new DomainError('Una carpeta de especialista requiere specialist_id.')
  }

  return FolderRepository.create({
    application_id: applicationId,
    type,
    name: trimmed,
    parent_folder_id: parentFolderId || null,
    specialist_id: specialistId || null,
    support_level_id: supportLevelId || null,
  })
}

import { FolderRepository } from '@/infrastructure/repositories/FolderRepository'

export async function updateFolderUseCase(id, { name, isActive, externalId }) {
  return FolderRepository.update(id, {
    name: name ?? null,
    is_active: isActive ?? null,
    external_id: externalId ?? null,
  })
}

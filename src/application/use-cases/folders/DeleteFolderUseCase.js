import { FolderRepository } from '@/infrastructure/repositories/FolderRepository'

export async function deleteFolderUseCase(id) {
  return FolderRepository.delete(id)
}

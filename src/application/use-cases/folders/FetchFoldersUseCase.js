import { FolderRepository } from '@/infrastructure/repositories/FolderRepository'

export async function fetchFoldersUseCase(applicationId) {
  return FolderRepository.fetchByApplication(applicationId)
}

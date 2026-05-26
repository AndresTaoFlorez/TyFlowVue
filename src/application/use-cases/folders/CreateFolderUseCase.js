import { FolderRepository } from '@/infrastructure/repositories/FolderRepository'

export async function createFolderUseCase({ applicationId, type, name, parentFolderId, specialistId, supportLevelId }) {
  return FolderRepository.create({
    application_id: applicationId,
    type,
    name,
    parent_folder_id: parentFolderId || null,
    specialist_id: specialistId || null,
    support_level_id: supportLevelId || null,
  })
}

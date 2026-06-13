import { AppSupportLevelCategoryRepository } from '@/infrastructure/repositories/AppSupportLevelCategoryRepository'

export async function fetchAppSupportLevelCategoriesUseCase(applicationId, supportLevelId) {
  return AppSupportLevelCategoryRepository.fetchAll(applicationId, supportLevelId)
}

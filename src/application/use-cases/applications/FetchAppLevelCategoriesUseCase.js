import { AppLevelCategoryRepository } from '@/infrastructure/repositories/AppLevelCategoryRepository'

export async function fetchAppLevelCategoriesUseCase(applicationId, supportLevelId) {
  return AppLevelCategoryRepository.fetchAll(applicationId, supportLevelId)
}

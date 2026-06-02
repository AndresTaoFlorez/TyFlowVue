import { SupportCategoryRepository } from '@/infrastructure/repositories/SupportCategoryRepository'

export async function fetchSupportCategoriesUseCase() {
  return SupportCategoryRepository.fetchAll()
}

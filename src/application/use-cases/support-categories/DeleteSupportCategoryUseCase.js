import { SupportCategoryRepository } from '@/infrastructure/repositories/SupportCategoryRepository'

export async function deleteSupportCategoryUseCase(categoryId) {
  return SupportCategoryRepository.delete(categoryId)
}

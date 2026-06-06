import { SpecialistSupportCategoryRepository } from '@/infrastructure/repositories/SpecialistSupportCategoryRepository'

export async function syncSpecialistSupportCategoriesUseCase(specialistId, entries) {
  return SpecialistSupportCategoryRepository.sync(specialistId, entries)
}

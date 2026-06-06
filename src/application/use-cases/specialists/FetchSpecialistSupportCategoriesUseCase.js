import { SpecialistSupportCategoryRepository } from '@/infrastructure/repositories/SpecialistSupportCategoryRepository'

export async function fetchSpecialistSupportCategoriesUseCase(specialistId) {
  return SpecialistSupportCategoryRepository.fetchAll(specialistId)
}

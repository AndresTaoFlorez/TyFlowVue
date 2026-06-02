import { SupportCategoryRepository } from '@/infrastructure/repositories/SupportCategoryRepository'

export async function createSupportCategoryUseCase({ name, description }) {
  return SupportCategoryRepository.create({
    name,
    description: description || undefined,
  })
}

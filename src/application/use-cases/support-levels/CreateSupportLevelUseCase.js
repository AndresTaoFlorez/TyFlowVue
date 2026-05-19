import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'

export async function createSupportLevelUseCase({ name, description }) {
  return SupportLevelRepository.create({
    name,
    description: description || undefined,
  })
}

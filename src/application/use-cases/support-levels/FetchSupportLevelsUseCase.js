import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'

export async function fetchSupportLevelsUseCase() {
  return SupportLevelRepository.fetchAll()
}

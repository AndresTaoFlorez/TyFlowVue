import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'

export async function deleteSupportLevelUseCase(supportLevelId) {
  return SupportLevelRepository.delete(supportLevelId)
}

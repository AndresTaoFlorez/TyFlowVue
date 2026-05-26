import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'

export async function deleteWorkWindowUseCase(id) {
  return WorkWindowRepository.deleteWindows([id])
}

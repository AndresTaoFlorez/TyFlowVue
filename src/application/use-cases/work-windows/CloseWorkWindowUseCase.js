import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'

export async function closeWorkWindowUseCase(id) {
  return WorkWindowRepository.closeSession(id)
}

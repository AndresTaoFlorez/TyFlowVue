import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'

export async function openWorkWindowUseCase(id, options = {}) {
  return WorkWindowRepository.openSession(id, options)
}

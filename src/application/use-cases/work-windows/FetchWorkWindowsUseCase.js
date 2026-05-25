import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'

export async function fetchWorkWindowsUseCase(params = {}) {
  return WorkWindowRepository.fetchAll(params)
}

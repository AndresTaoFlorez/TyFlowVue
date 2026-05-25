import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'

export async function createWorkWindowUseCase(data) {
  return WorkWindowRepository.create(data)
}

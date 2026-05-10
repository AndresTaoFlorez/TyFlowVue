import { AreaRepository } from '@/infrastructure/repositories/AreaRepository'

export async function fetchAreasUseCase() {
  return AreaRepository.fetchAll()
}

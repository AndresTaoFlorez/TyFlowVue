import { AreaRepository } from '@/infrastructure/repositories/AreaRepository'

export async function deleteAreaUseCase(areaId) {
  return AreaRepository.delete(areaId)
}

import { AreaRepository } from '@/infrastructure/repositories/AreaRepository'

export async function createAreaUseCase({ name, displayName, description }) {
  return AreaRepository.create({
    name,
    display_name: displayName,
    description: description || undefined,
  })
}

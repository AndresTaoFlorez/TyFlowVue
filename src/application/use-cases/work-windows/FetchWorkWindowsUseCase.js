import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function fetchWorkWindowsUseCase(params = {}) {
  try {
    return await WorkWindowRepository.fetchAll(params)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al cargar las ventanas de trabajo.')
  }
}

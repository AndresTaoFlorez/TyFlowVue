import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function mergeWorkWindowsUseCase(ids) {
  if (!Array.isArray(ids) || ids.length < 2) {
    throw new WorkWindowError('Selecciona al menos 2 ventanas para agrupar.')
  }

  try {
    return await WorkWindowRepository.merge(ids)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al agrupar las ventanas.')
  }
}

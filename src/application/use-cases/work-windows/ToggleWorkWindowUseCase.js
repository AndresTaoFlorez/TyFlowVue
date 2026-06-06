import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function toggleWorkWindowUseCase(window) {
  if (!window?.id) {
    throw new WorkWindowError('No se especificó la ventana.')
  }

  try {
    await WorkWindowRepository.toggleWindows([window.id])
    return await WorkWindowRepository.fetchById(window.id)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al cambiar el estado de la ventana.')
  }
}

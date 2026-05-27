import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function closeWorkWindowUseCase(window) {
  if (!window || !window.id) {
    throw new WorkWindowError('No se especificó la ventana a cerrar.')
  }
  if (!window.isSessionOpen) {
    throw new WorkWindowError('La sesión ya está cerrada.')
  }

  try {
    await WorkWindowRepository.closeSession(window.id)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al cerrar la sesión.')
  }

  return window.withClosed()
}

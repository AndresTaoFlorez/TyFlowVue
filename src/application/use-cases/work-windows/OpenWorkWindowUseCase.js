import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function openWorkWindowUseCase(window, options = {}) {
  if (!window || !window.id) {
    throw new WorkWindowError('No se especificó la ventana a abrir.')
  }
  if (window.isSessionOpen) {
    throw new WorkWindowError('La sesión ya está abierta.')
  }

  try {
    await WorkWindowRepository.openSession(window.id, options)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al abrir la sesión.')
  }

  return window.withOpened()
}

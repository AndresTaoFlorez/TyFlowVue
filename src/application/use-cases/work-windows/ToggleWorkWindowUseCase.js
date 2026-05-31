import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function toggleWorkWindowUseCase(window) {
  if (!window?.id) {
    throw new WorkWindowError('No se especificó la ventana.')
  }

  try {
    const results = await WorkWindowRepository.toggleWindows([window.id])
    const result = results.find(r => r.id === window.id)
    return window.withToggled(result.is_active)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al cambiar el estado de la ventana.')
  }
}

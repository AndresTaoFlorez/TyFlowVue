import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function toggleWorkWindowUseCase(window) {
  if (!window?.id) {
    throw new WorkWindowError('No se especificó la ventana.')
  }

  try {
    // POST /toggle was removed (API_CONTRACT §15): flip is_active via PATCH.
    const updated = await WorkWindowRepository.update(window.id, { isActive: !window.isActive })
    return updated ?? window.withToggled(!window.isActive)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al cambiar el estado de la ventana.')
  }
}

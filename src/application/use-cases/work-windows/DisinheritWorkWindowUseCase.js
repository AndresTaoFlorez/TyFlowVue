import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Removes inheritance from future work windows that haven't started yet.
 * Sets inherits_on_reopen = false and inherited_from_window_id = null.
 * @param {string[]} ids - Window IDs to disinherit
 * @returns {Promise<Array<{id: string, success: boolean, message: string}>>}
 */
export async function disinheritWorkWindowUseCase(ids) {
  if (!ids || ids.length === 0) {
    throw new WorkWindowError('No se especificaron ventanas.')
  }
  try {
    return await WorkWindowRepository.disinherit(ids)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al desactivar herencia.')
  }
}

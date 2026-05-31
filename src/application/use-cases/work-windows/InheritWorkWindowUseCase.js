import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Activates inheritance on future work windows that haven't started yet.
 * The DB auto-resolves the parent (most recent previous window for same specialist+application).
 * @param {string[]} ids - Window IDs to activate inheritance on
 * @returns {Promise<Array<{id: string, success: boolean, message: string}>>}
 */
export async function inheritWorkWindowUseCase(ids) {
  if (!ids || ids.length === 0) {
    throw new WorkWindowError('No se especificaron ventanas.')
  }
  try {
    return await WorkWindowRepository.inherit(ids)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al activar herencia.')
  }
}

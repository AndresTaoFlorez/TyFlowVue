import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Removes inheritance from future work windows that haven't started yet.
 * POST /disinherit was removed (API_CONTRACT §15): set `inherits_on_reopen:
 * false` via PATCH /work-windows. Children are auto-reconnected to the
 * grandparent (or made standalone) by the DB.
 * @param {string[]} ids - Window IDs to disinherit
 * @returns {Promise<{updated: WorkWindow[], failed: Array}>}
 */
export async function disinheritWorkWindowUseCase(ids) {
  if (!ids || ids.length === 0) {
    throw new WorkWindowError('No se especificaron ventanas.')
  }
  try {
    return await WorkWindowRepository.setInheritance(ids, false)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al desactivar herencia.')
  }
}

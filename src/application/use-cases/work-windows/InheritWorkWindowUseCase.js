import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Activates inheritance on future work windows that haven't started yet.
 * POST /inherit was removed (API_CONTRACT §15): inheritance is now a plain
 * `inherits_on_reopen` field on PATCH /work-windows. The DB auto-resolves the
 * parent (most recent previous window for the same specialist).
 * @param {string[]} ids - Window IDs to activate inheritance on
 * @returns {Promise<{updated: WorkWindow[], failed: Array}>}
 */
export async function inheritWorkWindowUseCase(ids) {
  if (!ids || ids.length === 0) {
    throw new WorkWindowError('No se especificaron ventanas.')
  }
  try {
    return await WorkWindowRepository.setInheritance(ids, true)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al activar herencia.')
  }
}

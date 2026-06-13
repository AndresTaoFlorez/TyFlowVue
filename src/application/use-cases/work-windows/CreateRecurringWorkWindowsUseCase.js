import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Crea una serie de ventanas para UN especialista. La expansión de fechas
 * ocurre en el cliente y las ocurrencias se crean como ventanas estándar en un
 * solo POST /work-windows (el endpoint /recurring fue eliminado, API_CONTRACT
 * §15). El backend valida pasado/solape por ítem.
 *
 * @param {object} params
 * @param {string} params.specialistId
 * @param {Array<{date: string, startTime: string, endTime: string}>} params.slots
 *        Fechas YYYY-MM-DD + horas HH:MM locales; se convierten a timestamptz.
 * @returns {Promise<WorkWindow[]>} ventanas creadas (objetos completos)
 */
export async function createRecurringWorkWindowsUseCase({ specialistId, slots }) {
  if (!specialistId) throw new WorkWindowError('Especialista requerido.')
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new WorkWindowError('Debe incluir al menos una ocurrencia.')
  }
  if (slots.length > 200) {
    throw new WorkWindowError('Máximo 200 ocurrencias por serie.')
  }

  const occurrences = slots.map(({ date, startTime, endTime }, i) => {
    if (!date || !startTime || !endTime) {
      throw new WorkWindowError(`Ocurrencia ${i + 1} incompleta.`)
    }
    return {
      starts_at: WorkWindow.toTimestampTz(date, startTime),
      ends_at: WorkWindow.toTimestampTz(date, endTime),
    }
  })

  try {
    return await WorkWindowRepository.createRecurring({ specialistId, occurrences })
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al crear la serie de ventanas.')
  }
}

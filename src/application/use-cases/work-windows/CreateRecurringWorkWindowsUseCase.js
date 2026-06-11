import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Crea una serie recurrente de ventanas para UN par especialista+aplicación
 * vía POST /work-windows/recurring. La expansión de fechas ocurre en el
 * cliente; el backend valida (pasado/solape), genera la cadena de herencia
 * (1ª ocurrencia hereda solo si existe ventana previa; 2..N encadenan entre
 * sí) y es atómico por serie.
 *
 * @param {object} params
 * @param {string} params.specialistId
 * @param {string} params.applicationId
 * @param {Array<{date: string, startTime: string, endTime: string}>} params.slots
 *        Fechas YYYY-MM-DD + horas HH:MM locales; se convierten a timestamptz.
 * @param {number} [params.affinityWeight=1]
 * @returns {Promise<WorkWindow[]>} ventanas creadas (objetos completos)
 */
export async function createRecurringWorkWindowsUseCase({ specialistId, applicationId, slots, affinityWeight = 1 }) {
  if (!specialistId) throw new WorkWindowError('Especialista requerido.')
  if (!applicationId) throw new WorkWindowError('Aplicación requerida.')
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
    return await WorkWindowRepository.createRecurring({
      specialistId,
      applicationId,
      occurrences,
      affinityWeight,
    })
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al crear la serie de ventanas.')
  }
}

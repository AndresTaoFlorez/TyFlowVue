import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Reschedules a work window to a new time range.
 * Note: The backend PATCH endpoint only supports changing start_time and end_time,
 * not scheduled_date. If the user drags to a different day, we reject the operation.
 */
export async function rescheduleWorkWindowUseCase(window, { startTime, endTime, targetDate }) {
  if (!window || !window.id) {
    throw new WorkWindowError('No se especificó la ventana a mover.')
  }

  if (targetDate && targetDate !== window.scheduledDate) {
    throw new WorkWindowError('No es posible mover la ventana a otro día. Solo se puede cambiar el horario.')
  }

  if (!startTime || !endTime) {
    throw new WorkWindowError('Se requiere hora de inicio y fin.')
  }

  const formattedStart = WorkWindow.formatTimeTz(startTime)
  const formattedEnd = WorkWindow.formatTimeTz(endTime)

  try {
    return await WorkWindowRepository.update(window.id, {
      startTime: formattedStart,
      endTime: formattedEnd,
    })
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al mover la ventana.')
  }
}

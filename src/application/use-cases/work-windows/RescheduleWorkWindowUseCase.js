import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Reschedules a work window to a new time range and/or a different day.
 */
export async function rescheduleWorkWindowUseCase(window, { startTime, endTime, targetDate }) {
  if (!window || !window.id) {
    throw new WorkWindowError('No se especificó la ventana a mover.')
  }

  if (!startTime || !endTime) {
    throw new WorkWindowError('Se requiere hora de inicio y fin.')
  }

  const formattedStart = WorkWindow.formatTimeTz(startTime)
  const formattedEnd = WorkWindow.formatTimeTz(endTime)

  const updatePayload = {
    startTime: formattedStart,
    endTime: formattedEnd,
  }

  if (targetDate && targetDate !== window.scheduledDate) {
    updatePayload.scheduledDate = targetDate
  }

  try {
    return await WorkWindowRepository.update(window.id, updatePayload)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al mover la ventana.')
  }
}

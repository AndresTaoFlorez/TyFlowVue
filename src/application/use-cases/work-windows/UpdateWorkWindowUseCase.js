import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function updateWorkWindowUseCase(window, data) {
  if (!window?.id) {
    throw new WorkWindowError('No se especificó la ventana a actualizar.')
  }

  const startDate = data.targetDate || window.scheduledDate
  const endDate = data.endDate || (data.targetDate ? data.targetDate : (window.endDate || window.scheduledDate))
  const payload = {}
  if (data.startTime != null) payload.startsAt = WorkWindow.toTimestampTz(startDate, data.startTime)
  if (data.endTime != null) payload.endsAt = WorkWindow.toTimestampTz(endDate, data.endTime)
  if (data.note != null) payload.note = data.note
  if (data.inheritsOnReopen != null) payload.inheritsOnReopen = data.inheritsOnReopen

  try {
    return await WorkWindowRepository.update(window.id, payload)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al actualizar la ventana.')
  }
}

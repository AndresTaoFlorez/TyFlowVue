import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function updateWorkWindowUseCase(window, data) {
  if (!window?.id) {
    throw new WorkWindowError('No se especificó la ventana a actualizar.')
  }

  const date = window.scheduledDate
  const payload = {}
  if (data.startTime != null) payload.startsAt = WorkWindow.toTimestampTz(date, data.startTime)
  if (data.endTime != null) payload.endsAt = WorkWindow.toTimestampTz(date, data.endTime)
  if (data.note != null) payload.note = data.note

  try {
    return await WorkWindowRepository.update(window.id, payload)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al actualizar la ventana.')
  }
}

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
  const startTime = data.startTime ?? window.startTime
  const endTime = data.endTime ?? window.endTime
  if (data.startTime != null || data.targetDate != null) payload.startsAt = WorkWindow.toTimestampTz(startDate, startTime)
  if (data.endTime != null || data.targetDate != null || data.endDate != null) payload.endsAt = WorkWindow.toTimestampTz(endDate, endTime)
  if (data.note != null) payload.note = data.note
  if (data.inheritsOnReopen != null) payload.inheritsOnReopen = data.inheritsOnReopen
  if (data.affinityWeight !== undefined) payload.affinityWeight = data.affinityWeight

  try {
    return await WorkWindowRepository.update(window.id, payload)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al actualizar la ventana.')
  }
}

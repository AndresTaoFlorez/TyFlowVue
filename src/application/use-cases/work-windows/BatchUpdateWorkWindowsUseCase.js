import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

/**
 * Batch-updates multiple work windows in a single PATCH request.
 * Each item: { window, data } where data may contain targetDate, startTime, endTime, note, etc.
 * Returns { updated: WorkWindow[], failed: [] }
 */
export async function batchUpdateWorkWindowsUseCase(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new WorkWindowError('No hay ventanas para actualizar.')
  }

  const batchPayload = items.map(({ window: w, data }) => {
    const startDate = data.targetDate || w.scheduledDate
    const endDate = data.endDate || (data.targetDate ? data.targetDate : (w.endDate || w.scheduledDate))
    const startTime = data.startTime ?? w.startTime
    const endTime = data.endTime ?? w.endTime

    const fields = { id: w.id }
    if (data.startTime != null || data.targetDate != null) fields.startsAt = WorkWindow.toTimestampTz(startDate, startTime)
    if (data.endTime != null || data.targetDate != null || data.endDate != null) fields.endsAt = WorkWindow.toTimestampTz(endDate, endTime)
    if (data.note != null) fields.note = data.note
    if (data.inheritsOnReopen != null) fields.inheritsOnReopen = data.inheritsOnReopen
    if (data.isActive !== undefined) fields.isActive = data.isActive
    return fields
  })

  try {
    return await WorkWindowRepository.batchUpdate(batchPayload)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al actualizar las ventanas.')
  }
}

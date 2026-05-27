import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function updateWorkWindowUseCase(id, data) {
  if (!id) {
    throw new WorkWindowError('No se especificó la ventana a actualizar.')
  }

  const payload = {}
  if (data.startTime != null) payload.startTime = WorkWindow.formatTimeTz(data.startTime)
  if (data.endTime != null) payload.endTime = WorkWindow.formatTimeTz(data.endTime)
  if (data.note != null) payload.note = data.note

  try {
    return await WorkWindowRepository.update(id, payload)
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al actualizar la ventana.')
  }
}

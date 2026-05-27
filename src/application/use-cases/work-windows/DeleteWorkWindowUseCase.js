import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'
import { WorkWindowError } from '@/domain/errors/WorkWindowError'

export async function deleteWorkWindowUseCase(id) {
  if (!id) {
    throw new WorkWindowError('No se especificó la ventana a eliminar.')
  }

  try {
    await WorkWindowRepository.deleteWindows([id])
  } catch (e) {
    throw WorkWindowError.fromHttp(e, 'Error al eliminar la ventana.')
  }
}

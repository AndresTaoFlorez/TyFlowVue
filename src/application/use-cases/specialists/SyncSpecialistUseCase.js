import { SpecialistRepository } from '@/infrastructure/repositories/SpecialistRepository'

/**
 * Sincroniza el estado de specialist y sus support levels después de guardar un usuario.
 *
 * - Nuevo specialist: crea registro + asigna support levels seleccionados
 * - Specialist existente: diff de support levels (agrega nuevos, elimina removidos)
 * - Dejó de ser specialist: elimina el registro (cascade borra support levels)
 * - No es specialist: no-op
 */
export async function syncSpecialistUseCase({
  userId,
  specialistId,
  wasSpecialist,
  isNowSpecialist,
  selectedSupportLevelIds,
}) {
  // Ya no es specialist → eliminar
  if (wasSpecialist && !isNowSpecialist) {
    await SpecialistRepository.delete(specialistId)
    return
  }

  // No era ni es specialist → nada
  if (!isNowSpecialist) return

  let currentSpecialistId = specialistId

  // Nuevo specialist → crear registro
  if (!wasSpecialist) {
    const specialist = await SpecialistRepository.create(userId)
    currentSpecialistId = specialist.id
  }

  // Sincronizar support levels
  const currentRecords = wasSpecialist
    ? await SpecialistRepository.fetchSupportLevels(currentSpecialistId)
    : []

  const currentMap = new Map(currentRecords.map(r => [r.support_level_id, r.id]))
  const selectedSet = new Set(selectedSupportLevelIds)

  // Agregar los que no existen
  const toAdd = selectedSupportLevelIds.filter(id => !currentMap.has(id))
  // Eliminar los que ya no están seleccionados
  const toRemove = currentRecords.filter(r => !selectedSet.has(r.support_level_id))

  await Promise.all([
    ...toAdd.map(slId => SpecialistRepository.assignSupportLevel(currentSpecialistId, slId)),
    ...toRemove.map(r => SpecialistRepository.removeSupportLevel(r.id)),
  ])
}

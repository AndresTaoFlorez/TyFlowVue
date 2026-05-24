import { SpecialistRepository } from '@/infrastructure/repositories/SpecialistRepository'

/**
 * Sincroniza los support levels de un specialist después de guardar un usuario.
 *
 * El backend crea/elimina el registro specialist automáticamente al recibir role_ids.
 * Este use case solo gestiona la relación specialist ↔ support_level.
 *
 * @param {string} specialistId - specialist_id del response del user save
 * @param {string[]} selectedSupportLevelIds - IDs seleccionados en el formulario
 * @param {boolean} wasSpecialist - si ya tenía specialistId antes del save
 */
export async function syncSpecialistUseCase({ specialistId, selectedSupportLevelIds, wasSpecialist }) {
  if (!specialistId) return

  // Si ya era specialist, diff contra los actuales; si es nuevo, todo es nuevo
  const currentRecords = wasSpecialist
    ? await SpecialistRepository.fetchSupportLevels(specialistId)
    : []

  const currentMap = new Map(currentRecords.map(r => [r.support_level_id, r.id]))
  const selectedSet = new Set(selectedSupportLevelIds)

  const toAdd = selectedSupportLevelIds.filter(id => !currentMap.has(id))
  const toRemove = currentRecords.filter(r => !selectedSet.has(r.support_level_id))

  await Promise.all([
    ...toAdd.map(slId => SpecialistRepository.assignSupportLevel(specialistId, slId)),
    ...toRemove.map(r => SpecialistRepository.removeSupportLevel(r.id)),
  ])
}

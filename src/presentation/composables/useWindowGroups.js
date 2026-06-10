import { computed } from 'vue'

/**
 * Posiciona las ventanas de UN día (función pura, reutilizable).
 *
 * Ya NO se agrupan ventanas: cada una es un item { type:'single', window }.
 * Los solapes se resuelven con columnas lado a lado (estilo Google Calendar)
 * mediante buildClusters + asignación de _col/_totalCols. Nunca se devuelve
 * type:'group'.
 *
 * Devuelve un array de items { type:'single', window, _col, _totalCols }.
 * Usado por useWindowGroups y por findGroupForWindow (que sobre singles siempre
 * retorna null, comportamiento esperado para el deep-link ?group=).
 *
 * `getName(window) => string` resuelve el nombre del especialista para ORDENAR
 * las columnas (ver abajo). Si no se pasa, cae a specialistId.
 */
export function groupDayWindows(dayWindows, getName) {
  // Una ventana por bloque, ordenadas por hora de inicio.
  const sorted = (dayWindows || [])
    .map(w => ({ type: 'single', window: w, _col: 0, _totalCols: 1 }))
    .sort((a, b) => a.window.startHour - b.window.startHour)

  if (sorted.length <= 1) return sorted

  // Build overlap clusters — blocks that overlap transitively share a cluster
  // (la detección de clusters necesita orden por hora de inicio).
  const clusters = buildClusters(sorted)

  // Orden de COLUMNAS (izquierda→derecha), consistente siempre:
  //   1º alfabético por nombre del especialista,
  //   2º (desempate) por duración del rango de mayor a menor.
  const nameOf = (b) => (getName ? getName(b.window) : b.window.specialistId) || ''
  const durOf = (b) => b.window.endHour - b.window.startHour
  const colOrder = (a, b) => {
    const n = nameOf(a).localeCompare(nameOf(b), 'es', { sensitivity: 'base' })
    if (n !== 0) return n
    return durOf(b) - durOf(a)
  }

  // Assign columns within each cluster independently, recorriendo los bloques en
  // el orden deseado para que el índice de columna refleje (nombre, -duración).
  for (const cluster of clusters) {
    const colEndTimes = []
    for (const block of [...cluster].sort(colOrder)) {
      const bStart = block.window.startHour
      const bEnd = block.window.endHour
      let assignedCol = colEndTimes.findIndex(endTime => endTime <= bStart)
      if (assignedCol === -1) {
        assignedCol = colEndTimes.length
        colEndTimes.push(bEnd)
      } else {
        colEndTimes[assignedCol] = bEnd
      }
      block._col = assignedCol
    }
    const totalCols = colEndTimes.length || 1
    for (const block of cluster) block._totalCols = totalCols
  }

  return sorted
}

/**
 * Reconstruye el grupo (multi-ventana) que contiene a la ventana `id`, a partir
 * de la lista plana de todas las ventanas. Devuelve el item group, o null si la
 * ventana no pertenece a ningún grupo (es individual). Para modales por URL.
 */
export function findGroupForWindow(allWindows, id) {
  const target = (allWindows || []).find(w => w.id === id)
  if (!target) return null
  const sameDay = allWindows.filter(w => w.scheduledDate === target.scheduledDate)
  const items = groupDayWindows(sameDay)
  return items.find(it => it.type === 'group' && it.windows.some(w => w.id === id)) || null
}

export function useWindowGroups(windowsByDay, getName) {
  return computed(() => windowsByDay.value.map(d => groupDayWindows(d, getName)))
}

/**
 * Build overlap clusters: groups of blocks that overlap transitively.
 * Blocks A and B are in the same cluster if their time ranges overlap,
 * or if they both overlap with some block C.
 */
function buildClusters(sorted) {
  if (sorted.length === 0) return []

  const clusters = []
  let currentCluster = [sorted[0]]
  let clusterEnd = blockEnd(sorted[0])

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i]
    const bStart = blockStart(block)

    if (bStart < clusterEnd) {
      // Overlaps with current cluster
      currentCluster.push(block)
      clusterEnd = Math.max(clusterEnd, blockEnd(block))
    } else {
      // No overlap — start new cluster
      clusters.push(currentCluster)
      currentCluster = [block]
      clusterEnd = blockEnd(block)
    }
  }
  clusters.push(currentCluster)

  return clusters
}

function blockStart(block) {
  return block.type === 'group' ? block.startHour : block.window.startHour
}

function blockEnd(block) {
  return block.type === 'group' ? block.endHour : block.window.endHour
}

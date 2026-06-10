import { computed } from 'vue'

/**
 * Groups overlapping windows per day.
 * Windows are grouped when they share the same scheduledDate
 * and their startHour/endHour are identical (or overlap > 80%).
 *
 * Returns: Array[days] of arrays, each containing either:
 *   - { type: 'single', window, _col, _totalCols }
 *   - { type: 'group', windows: [...], startHour, endHour, _col, _totalCols, id }
 */
/**
 * Agrupa las ventanas de UN día (función pura, reutilizable).
 * Devuelve un array de items { type:'single'|'group', ... } con columnas
 * asignadas. Usado por useWindowGroups y por findGroupForWindow (reconstrucción
 * de un grupo desde la URL para modales deep-linkables).
 */
export function groupDayWindows(dayWindows) {
  if (!dayWindows || dayWindows.length <= 1) {
    return (dayWindows || []).map(w => ({ type: 'single', window: w, _col: 0, _totalCols: 1 }))
  }

  // Group by similar time ranges
  const groups = []
  const used = new Set()

  for (let i = 0; i < dayWindows.length; i++) {
    if (used.has(i)) continue
    const a = dayWindows[i]
    const members = [a]
    used.add(i)

    for (let j = i + 1; j < dayWindows.length; j++) {
      if (used.has(j)) continue
      const b = dayWindows[j]
      if (shouldGroup(a, b)) {
        members.push(b)
        used.add(j)
      }
    }

    if (members.length === 1) {
      groups.push({ type: 'single', window: a, _col: 0, _totalCols: 1 })
    } else {
      const startHour = Math.min(...members.map(m => m.startHour))
      const endHour = Math.max(...members.map(m => m.endHour))
      groups.push({
        type: 'group',
        windows: members,
        startHour,
        endHour,
        id: `group-${members.map(m => m.id).join('-')}`,
        _col: 0,
        _totalCols: 1,
      })
    }
  }

  // Sort by start time
  const sorted = groups.sort((a, b) => {
    const aStart = a.type === 'group' ? a.startHour : a.window.startHour
    const bStart = b.type === 'group' ? b.startHour : b.window.startHour
    return aStart - bStart
  })

  // Build overlap clusters — blocks that overlap transitively share a cluster
  const clusters = buildClusters(sorted)

  // Assign columns within each cluster independently
  for (const cluster of clusters) {
    const colEndTimes = []
    for (const block of cluster) {
      const bStart = block.type === 'group' ? block.startHour : block.window.startHour
      const bEnd = block.type === 'group' ? block.endHour : block.window.endHour
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

export function useWindowGroups(windowsByDay) {
  return computed(() => windowsByDay.value.map(groupDayWindows))
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

function shouldGroup(a, b) {
  // Exact match
  if (a.startHour === b.startHour && a.endHour === b.endHour) return true

  // Same start or same end → always group
  if (a.startHour === b.startHour || a.endHour === b.endHour) return true

  // Overlap > 80%
  const overlapStart = Math.max(a.startHour, b.startHour)
  const overlapEnd = Math.min(a.endHour, b.endHour)
  if (overlapEnd <= overlapStart) return false

  const overlap = overlapEnd - overlapStart
  const maxDuration = Math.max(a.endHour - a.startHour, b.endHour - b.startHour)
  return (overlap / maxDuration) > 0.8
}

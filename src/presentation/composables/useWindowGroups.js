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
  const list = dayWindows || []
  if (list.length === 0) return []

  // Agrupar SOLO ventanas con starts_at Y ends_at idénticos (mismo rango exacto):
  // se muestran como UN solo bloque con varios avatares. Las demás van como
  // bloques individuales lado a lado.
  // La clave compara INSTANTES (epoch), no strings: una ventana movida localmente
  // queda con offset local (-05:00) mientras el backend serializa en otro formato;
  // mismo instante con strings distintos impedía agrupar hasta recargar.
  const byRange = new Map()
  for (const w of list) {
    const key = `${new Date(w.startsAt).getTime()}|${new Date(w.endsAt).getTime()}`
    if (!byRange.has(key)) byRange.set(key, [])
    byRange.get(key).push(w)
  }
  const items = []
  for (const members of byRange.values()) {
    if (members.length === 1) {
      items.push({ type: 'single', window: members[0], _col: 0, _totalCols: 1 })
    } else {
      const w0 = members[0]
      items.push({
        type: 'group',
        windows: members,
        startHour: w0.startHour,
        endHour: w0.endHour,
        id: `group-${members.map(m => m.id).join('-')}`,
        _col: 0,
        _totalCols: 1,
      })
    }
  }

  // Orden por hora de inicio (lo necesita la detección de clusters de solape).
  const sorted = items.sort((a, b) => blockStart(a) - blockStart(b))
  if (sorted.length <= 1) return sorted

  const clusters = buildClusters(sorted)

  // Orden de COLUMNAS (izquierda→derecha), consistente siempre:
  //   1º alfabético por nombre del especialista (para un grupo: el menor),
  //   2º (desempate) por duración del rango de mayor a menor.
  const nameOf = (b) => {
    if (b.type === 'group') {
      return b.windows
        .map(w => (getName ? getName(w) : w.specialistId) || '')
        .sort((x, y) => x.localeCompare(y, 'es', { sensitivity: 'base' }))[0] || ''
    }
    return (getName ? getName(b.window) : b.window.specialistId) || ''
  }
  const colOrder = (a, b) => {
    const n = nameOf(a).localeCompare(nameOf(b), 'es', { sensitivity: 'base' })
    if (n !== 0) return n
    return (blockEnd(b) - blockStart(b)) - (blockEnd(a) - blockStart(a))
  }

  // Assign columns within each cluster independently, recorriendo los bloques en
  // el orden deseado para que el índice de columna refleje (nombre, -duración).
  for (const cluster of clusters) {
    const colEndTimes = []
    for (const block of [...cluster].sort(colOrder)) {
      const bStart = blockStart(block)
      const bEnd = blockEnd(block)
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

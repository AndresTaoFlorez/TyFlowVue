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
export function useWindowGroups(windowsByDay) {
  return computed(() => {
    return windowsByDay.value.map(dayWindows => {
      if (dayWindows.length <= 1) {
        return dayWindows.map(w => ({ type: 'single', window: w, _col: 0, _totalCols: 1 }))
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

      // Assign columns
      const sorted = groups.sort((a, b) => {
        const aStart = a.type === 'group' ? a.startHour : a.window.startHour
        const bStart = b.type === 'group' ? b.startHour : b.window.startHour
        return aStart - bStart
      })

      const colEndTimes = []
      for (const block of sorted) {
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
      for (const block of sorted) block._totalCols = totalCols

      return sorted
    })
  })
}

function shouldGroup(a, b) {
  // Exact match
  if (a.startHour === b.startHour && a.endHour === b.endHour) return true

  // Overlap > 80%
  const overlapStart = Math.max(a.startHour, b.startHour)
  const overlapEnd = Math.min(a.endHour, b.endHour)
  if (overlapEnd <= overlapStart) return false

  const overlap = overlapEnd - overlapStart
  const maxDuration = Math.max(a.endHour - a.startHour, b.endHour - b.startHour)
  return (overlap / maxDuration) > 0.8
}

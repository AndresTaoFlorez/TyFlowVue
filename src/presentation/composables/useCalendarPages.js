import { computed } from 'vue'
import {
  weekDatesForOffset,
  dayDateForOffset,
  monthDatesForOffset,
  monthNumForOffset,
} from '@/presentation/stores/useCalendarStore'

/**
 * Three-page buffer datasets (prev / current / next) for the calendar.
 *
 * Each page is derived reactively from the store offsets, so navigating just
 * means changing an offset — the pages recompute and the track recenters.
 * Window data is sliced from the already-loaded `calStore.windows` (the store
 * prefetches adjacent ranges), applying the same filters as `windowsFiltradas`.
 *
 * @param {object} calStore  instance of useCalendarStore()
 * @returns {{ prev, current, next, pages }}  computed page descriptors:
 *   { key, viewMode, weekDates, monthDates, currentMonth, windows }
 */
export function useCalendarPages(calStore) {
  function filterRange(from, to) {
    return calStore.windows.filter(w => {
      if (from && to && w.scheduledDate) {
        if (w.scheduledDate < from || w.scheduledDate > to) return false
      }
      if (calStore.filtroSpecialist !== 'all' && w.specialistId !== calStore.filtroSpecialist) return false
      if (calStore.filtroApp !== 'all' && w.applicationId !== calStore.filtroApp) return false
      return true
    })
  }

  function pageFor(delta) {
    const view = calStore.calView
    if (view === 'day') {
      const off = calStore.dayOffset + delta
      const date = dayDateForOffset(off)
      return {
        key: `d${off}`, viewMode: 'day',
        weekDates: [date], monthDates: [], currentMonth: 0,
        windows: filterRange(date, date),
      }
    }
    if (view === 'month') {
      const off = calStore.monthOffset + delta
      const md = monthDatesForOffset(off)
      return {
        key: `m${off}`, viewMode: 'month',
        weekDates: [md[0], md[md.length - 1]], monthDates: md, currentMonth: monthNumForOffset(off),
        windows: filterRange(md[0], md[md.length - 1]),
      }
    }
    const off = calStore.weekOffset + delta
    const wd = weekDatesForOffset(off)
    return {
      key: `w${off}`, viewMode: 'week',
      weekDates: wd, monthDates: [], currentMonth: 0,
      windows: filterRange(wd[0], wd[wd.length - 1]),
    }
  }

  const prev = computed(() => pageFor(-1))
  const current = computed(() => pageFor(0))
  const next = computed(() => pageFor(1))
  const pages = computed(() => [prev.value, current.value, next.value])

  return { prev, current, next, pages }
}

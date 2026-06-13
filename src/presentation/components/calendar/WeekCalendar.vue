<script setup>
import '@/presentation/styles/calendar/WeekCalendar.css'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import CalendarPage from '@/presentation/components/calendar/CalendarPage.vue'
import { useCalendarStore } from '@/presentation/stores/useCalendarStore'
import { useCalendarPages } from '@/presentation/composables/useCalendarPages'
import { useCalendarPager } from '@/presentation/composables/useCalendarPager'

// Props mirror what CalendarioView passes. The page datasets (prev/current/next)
// are derived from the store via useCalendarPages, so windows/weekDates/monthDates
// props are accepted for compatibility but the buffer reads the store directly.
const props = defineProps({
  windows: { type: Array, default: () => [] },
  weekDates: { type: Array, default: () => [] },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  density: { type: String, default: 'comfortable' },
  isMobile: { type: Boolean, default: false },
  viewMode: { type: String, default: 'week' },
  monthDates: { type: Array, default: () => [] },
  currentMonth: { type: Number, default: 0 },
  activeTool: { type: String, default: 'default' },
  selectedWindowIds: { type: Object, default: () => new Set() },
  cutWindowIds: { type: Object, default: () => new Set() },
  slideDir: { type: String, default: '' },
})

const emit = defineEmits([
  'select', 'range-selected', 'group-select', 'reschedule', 'group-reschedule',
  'batch-reschedule', 'batch-resize', 'next-day', 'prev-day', 'next-week', 'prev-week',
  'next-month', 'prev-month', 'resize', 'group-resize', 'select-day', 'context-window',
  'context-group', 'context-cell', 'horizontal-expand', 'erase', 'selection-change',
])

const calStore = useCalendarStore()
const { pages } = useCalendarPages(calStore)

const trackEl = ref(null)

const pager = useCalendarPager({
  getTrack: () => trackEl.value,
  getViewMode: () => props.viewMode,
  onNavigate: (dir) => {
    const v = props.viewMode
    if (dir > 0) emit(v === 'day' ? 'next-day' : v === 'month' ? 'next-month' : 'next-week')
    else emit(v === 'day' ? 'prev-day' : v === 'month' ? 'prev-month' : 'prev-week')
  },
})

// Re-emit the center page's interaction events up to CalendarioView.
const FORWARD = [
  'select', 'group-select', 'range-selected', 'reschedule', 'group-reschedule',
  'batch-reschedule', 'batch-resize', 'resize', 'group-resize', 'select-day',
  'context-window', 'context-group', 'context-cell', 'horizontal-expand',
  'erase', 'selection-change',
]
const centerListeners = Object.fromEntries(
  FORWARD.map(name => [name, (...args) => emit(name, ...args)])
)

// Keep the track centered on the current page. Recenter synchronously on mount
// (before paint) so there's no off-center flash, and after view changes.
onMounted(() => pager.recenter())
watch(() => props.viewMode, () => nextTick(pager.recenter))

// Resize-proofing: GSAP bakes xPercent → px using the width at apply time, so a
// later resize (window OR sidebar collapse) leaves a stale transform that
// breaks the layout. Re-center on any container size change (skip mid-animation).
let _ro = null
let _roRaf = 0
onMounted(() => {
  const el = trackEl.value?.parentElement
  if (!el || typeof ResizeObserver === 'undefined') return
  _ro = new ResizeObserver(() => {
    if (pager.isAnimating()) return
    cancelAnimationFrame(_roRaf)
    _roRaf = requestAnimationFrame(() => pager.recenter())
  })
  _ro.observe(el)
})
onBeforeUnmount(() => {
  if (_ro) _ro.disconnect()
  cancelAnimationFrame(_roRaf)
})

// Animate ±1 navigations triggered outside the pager (arrow buttons, "Hoy",
// date picker). Multi-step jumps just snap to center.
const activeOffset = computed(() =>
  props.viewMode === 'day' ? calStore.dayOffset
    : props.viewMode === 'month' ? calStore.monthOffset
      : calStore.weekOffset
)
watch(activeOffset, (n, o) => {
  if (pager.isAnimating()) return        // our own wheel/swipe commit handles visuals
  const delta = n - o
  if (Math.abs(delta) === 1) pager.animateNav(delta > 0 ? 1 : -1)
  else pager.recenter()
}, { flush: 'post' })
</script>

<template>
  <div
    class="cal-pager"
    @wheel="pager.onWheel"
    @touchstart.passive="pager.onTouchStart"
    @touchmove="pager.onTouchMove"
    @touchend="pager.onTouchEnd"
  >
    <div ref="trackEl" class="cal-pager__track">
      <div
        v-for="(p, idx) in pages"
        :key="p.key"
        class="cal-pager__page"
        :class="{ 'cal-pager__page--side': idx !== 1 }"
      >
        <CalendarPage
          :view-mode="p.viewMode"
          :week-dates="p.weekDates"
          :month-dates="p.monthDates"
          :current-month="p.currentMonth"
          :windows="p.windows"
          :specialists="specialists"
          :applications="applications"
          :density="density"
          :is-mobile="isMobile"
          :selectable="idx === 1 && selectable"
          :active-tool="activeTool"
          :selected-window-ids="selectedWindowIds"
          :cut-window-ids="cutWindowIds"
          :pager-controlled="true"
          v-on="idx === 1 ? centerListeners : {}"
        />
      </div>
    </div>
  </div>
</template>

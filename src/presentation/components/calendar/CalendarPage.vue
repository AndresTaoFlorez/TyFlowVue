<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import WindowBlock from '@/presentation/components/calendar/WindowBlock.vue'
import WindowGroupBlock from '@/presentation/components/calendar/WindowGroupBlock.vue'
import { useWindowGroups } from '@/presentation/composables/useWindowGroups'
import { fmtHM, fmtSlotTime, formatHour, formatHourCompact } from '@/presentation/helpers/formatTime'
import { fmtDateISO } from '@/presentation/helpers/formatDate'
import { readableTextColor } from '@/presentation/utils/color'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const _prefs = usePreferencesStore()
// Mejor color de texto para horas/cabecera, calculado sobre el tono real de la
// cuadrilla (misma función que el texto de las work windows). Theme-aware.
const calAutoText = computed(() => {
  void _prefs.theme
  return readableTextColor('var(--cal-col)', undefined, { minContrast: 4 })
})

const props = defineProps({
  windows: { type: Array, default: () => [] },
  weekDates: { type: Array, required: true },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  density: { type: String, default: 'comfortable' }, // 'compact' | 'comfortable' | 'spacious'
  isMobile: { type: Boolean, default: false },
  viewMode: { type: String, default: 'week' }, // 'day' | 'week' | 'month'
  monthDates: { type: Array, default: () => [] }, // 42 ISO date strings for month grid
  currentMonth: { type: Number, default: 0 }, // 0-11 for month view
  activeTool: { type: String, default: 'default' }, // 'default' | 'eraser' | 'select'
  selectedWindowIds: { type: Object, default: () => new Set() }, // Set<string>
  cutWindowIds: { type: Object, default: () => new Set() }, // Set<string>
  slideDir: { type: String, default: '' }, // 'slide-left' | 'slide-right' | ''
  // When true, the parent orchestrator owns navigation gestures (wheel/swipe/track)
  // and this page's internal pan/slide is disabled. Used by the 3-page buffer.
  pagerControlled: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'range-selected', 'group-select', 'reschedule', 'group-reschedule', 'batch-reschedule', 'batch-resize', 'next-day', 'prev-day', 'next-week', 'prev-week', 'next-month', 'prev-month', 'resize', 'group-resize', 'select-day', 'context-window', 'context-group', 'context-cell', 'horizontal-expand', 'erase', 'selection-change'])

// Density-aware slot/hour heights
const DENSITY_MAP = {
  compact:     { slot: 16, hour: 32 },
  comfortable: { slot: 24, hour: 48 },
  spacious:    { slot: 34, hour: 68 },
}
const COMPACT_SLOT_H = 18       // px per half-hour slot (compact mobile week)
const COMPACT_HOUR_H = COMPACT_SLOT_H * 2 // px per hour (compact)

const SLOT_H = computed(() => DENSITY_MAP[props.density]?.slot ?? 24)
const HOUR_H = computed(() => DENSITY_MAP[props.density]?.hour ?? 48)
const BASE_HOUR = 0
const SLOTS = Array.from({ length: 48 }, (_, i) => i)  // 0..47 → 00:00, 00:30, …, 23:30
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const scrollContainerDay = ref(null)
const scrollContainerCompact = ref(null)
const scrollContainerWeek = ref(null)
const panCompactHeaderRef = ref(null)
const panCompactBodyRef = ref(null)
const panMonthRef = ref(null)

const scrollContainer = computed(() =>
  scrollContainerDay.value ||
  scrollContainerCompact.value ||
  scrollContainerWeek.value ||
  null
)

// ---- View mode computeds ----
const showSingleDay = computed(() => {
  return props.viewMode === 'day'
})

const showCompactWeek = computed(() => {
  return props.isMobile && props.viewMode === 'week'
})
const activeMobileDay = ref(0)

let swipeStartX = 0
let swipeStartY = 0
let touchOnBlock = false // true when touch started on a window/group block

// ---- Navigation pan ("follow the finger") ----
const panX = ref(0)
const panLock = ref(null)  // null | 'h' | 'v'
let panInitiatedNav = false
let panBusy = false
const PAN_COMMIT = 80

const _sleep = (ms) => new Promise(r => setTimeout(r, ms))

function _getPanEls() {
  if (showSingleDay.value) return scrollContainerDay.value ? [scrollContainerDay.value] : []
  if (showCompactWeek.value) return [panCompactHeaderRef.value, panCompactBodyRef.value].filter(Boolean)
  if (props.viewMode === 'month') return panMonthRef.value ? [panMonthRef.value] : []
  return []
}

async function _commitPan(dx) {
  if (panBusy) return
  panBusy = true
  panLock.value = null
  panX.value = 0
  const exitDir = dx < 0 ? -1 : 1
  const W = window.innerWidth
  const els = _getPanEls()
  if (!els.length) { panBusy = false; return }

  // Phase 1: Slide old content off-screen (visible exit — no blank frame)
  const exitX = exitDir < 0 ? -(W + 40) : (W + 40)
  for (const el of els) {
    el.style.transition = 'transform 0.15s ease-in'
    el.style.transform = `translateX(${exitX}px)`
  }
  await _sleep(160)

  // Phase 2: Navigate — content swaps in DOM while fully off-screen
  panInitiatedNav = true
  if (showSingleDay.value) emit(exitDir < 0 ? 'next-day' : 'prev-day')
  else if (showCompactWeek.value) emit(exitDir < 0 ? 'next-week' : 'prev-week')
  else if (props.viewMode === 'month') emit(exitDir < 0 ? 'next-month' : 'prev-month')
  await nextTick()

  // Phase 3: Position new content on opposite side (invisible — still off-screen)
  const enterX = exitDir < 0 ? (W + 40) : -(W + 40)
  for (const el of els) {
    el.style.transition = 'none'
    el.style.transform = `translateX(${enterX}px)`
  }
  els.forEach(el => void el.offsetWidth) // force reflow

  // Phase 4: Slide new content in
  for (const el of els) {
    el.style.transition = 'transform 0.25s ease-out'
    el.style.transform = 'translateX(0)'
  }
  setTimeout(() => {
    els.forEach(el => { el.style.transition = ''; el.style.transform = '' })
    panInitiatedNav = false
    panBusy = false
  }, 270)
}

function _springBack() {
  panLock.value = null
  panX.value = 0
  const els = _getPanEls()
  for (const el of els) {
    el.style.transition = 'transform 0.2s ease-out'
    el.style.transform = 'translateX(0)'
  }
  setTimeout(() => { els.forEach(el => { el.style.transition = ''; el.style.transform = '' }) }, 220)
}

const onCalSwipeStart = (e) => {
  if (props.pagerControlled) return
  swipeStartX = e.touches[0].clientX
  swipeStartY = e.touches[0].clientY
  panLock.value = null
  panX.value = 0
}

const onCalSwipeMove = (e) => {
  if (props.pagerControlled) return
  if (blockDragging.value || resizing.value || panBusy) return
  const dx = e.touches[0].clientX - swipeStartX
  const dy = e.touches[0].clientY - swipeStartY
  if (panLock.value === null) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    panLock.value = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
    if (panLock.value === 'h' && touchOnBlock) {
      // Horizontal swipe confirmed — cancel any pending block/group drag
      if (blockDragTimer !== null) {
        clearTimeout(blockDragTimer)
        blockDragTimer = null
        _pendingDrag = null
      }
      touchOnBlock = false
    }
    if (panLock.value === 'v') return
  }
  if (panLock.value !== 'h') return
  if (e.cancelable) e.preventDefault()
  const els = _getPanEls()
  for (const el of els) el.style.transform = `translateX(${dx}px)`
  panX.value = dx
}

const onCalSwipeEnd = (e) => {
  if (props.pagerControlled) return
  if (panLock.value === 'h') {
    const dx = panX.value
    panLock.value = null
    if (Math.abs(dx) >= PAN_COMMIT) _commitPan(dx)
    else _springBack()
    return
  }

  panLock.value = null
  panX.value = 0

  // Fallback: fast swipe with no touchmove pan tracked
  const dx = e.changedTouches[0].clientX - swipeStartX
  const dy = e.changedTouches[0].clientY - swipeStartY
  if (Math.abs(dx) < Math.abs(dy) * 0.8 || Math.abs(dx) < 80) return
  if (props.viewMode === 'day') { _commitPan(dx); return }
  if (props.viewMode === 'month') { _commitPan(dx); return }
  // Legacy compact-week within-day navigation (not used in swipe-to-navigate flow)
  if (dx < 0 && activeMobileDay.value < props.weekDates.length - 1) activeMobileDay.value++
  if (dx > 0 && activeMobileDay.value > 0) activeMobileDay.value--
}

const onHeaderSwipeEnd = (e) => {
  if (props.pagerControlled) return
  if (touchOnBlock) return

  if (panLock.value === 'h') {
    const dx = panX.value
    panLock.value = null
    if (Math.abs(dx) >= PAN_COMMIT) _commitPan(dx)
    else _springBack()
    return
  }

  panLock.value = null
  panX.value = 0

  // Fallback fast swipe
  const dx = e.changedTouches[0].clientX - swipeStartX
  const dy = e.changedTouches[0].clientY - swipeStartY
  if (Math.abs(dx) < Math.abs(dy) * 0.8 || Math.abs(dx) < 80) return
  emit(dx < 0 ? 'next-week' : 'prev-week')
}

// ---- Sticky date pill for day scroll ----
const dayScrolled = ref(false)

const activeDayLabel = computed(() => {
  const dateStr = props.weekDates.length === 1
    ? props.weekDates[0]
    : props.weekDates[activeMobileDay.value]
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
})

// ---- Today & current time ----
const now = ref(new Date())
let timeInterval = null

const todayStr = computed(() => fmtDateISO(now.value))
const todayIndex = computed(() => props.weekDates.indexOf(todayStr.value))

// Reset active day when entering single-day mode
watch(showSingleDay, (val) => {
  if (val) {
    activeMobileDay.value = props.weekDates.length === 1 ? 0 : (todayIndex.value >= 0 ? todayIndex.value : 0)
  }
})

// Reset activeMobileDay when weekDates changes
watch(() => props.weekDates, () => {
  if (props.weekDates.length === 1) {
    activeMobileDay.value = 0
  } else if (showSingleDay.value) {
    // Switching from day→week on mobile: jump to today's column
    activeMobileDay.value = todayIndex.value >= 0 ? todayIndex.value : 0
  }
})

const currentTimeTop = computed(() => {
  const d = now.value
  return (d.getHours() + d.getMinutes() / 60) * HOUR_H.value
})

const onScrollContainer = () => {
  const el = scrollContainer.value
  if (!el) return
  dayScrolled.value = el.scrollTop > 60
}

const scrollToWorkHour = () => {
  if (!scrollContainer.value) return
  const targetHour = 7
  const px = targetHour * (showCompactWeek.value ? COMPACT_HOUR_H : HOUR_H.value)
  scrollContainer.value.scrollTop = Math.max(0, px - 32)
}

// Watch the active scroll container — re-attach listener and auto-scroll on view change
watch(scrollContainer, (newEl, oldEl) => {
  if (oldEl) oldEl.removeEventListener('scroll', onScrollContainer)
  if (newEl) {
    newEl.addEventListener('scroll', onScrollContainer, { passive: true })
    nextTick(scrollToWorkHour)
  }
})

onMounted(() => {
  timeInterval = setInterval(() => { now.value = new Date() }, 30000)
  if (showSingleDay.value) {
    activeMobileDay.value = props.weekDates.length === 1 ? 0 : (todayIndex.value >= 0 ? todayIndex.value : 0)
  }
})

// ---- Drag selection (multi-column) ----
const dragging = ref(false)
const dragStartDay = ref(-1)
const dragStartSlot = ref(0)
const dragEndDay = ref(-1)
const dragEndSlot = ref(0)

const selDayMin = computed(() => Math.min(dragStartDay.value, dragEndDay.value))
const selDayMax = computed(() => Math.max(dragStartDay.value, dragEndDay.value))
const selSlotMin = computed(() => Math.min(dragStartSlot.value, dragEndSlot.value))
const selSlotMax = computed(() => Math.max(dragStartSlot.value, dragEndSlot.value) + 1)

const isDayInSelection = (dayIdx) => {
  if (!dragging.value) return false
  return dayIdx >= selDayMin.value && dayIdx <= selDayMax.value
}

const selectionStyle = computed(() => {
  if (!dragging.value) return null
  return {
    top: selSlotMin.value * SLOT_H.value + 'px',
    height: (selSlotMax.value - selSlotMin.value) * SLOT_H.value + 'px',
  }
})

const selectionLabel = computed(() => {
  if (!dragging.value) return ''
  return `${fmtSlotTime(selSlotMin.value)} – ${fmtSlotTime(selSlotMax.value)}`
})

// ---- Marquee de selección 2D (modo "select", solo ratón) ----
// Rectángulo real en coordenadas de cliente: selecciona SOLO las ventanas cuyo
// recuadro realmente toca (incluida la columna), y no se traba en los bordes
// porque el rastreo es a nivel window (no celda por celda). En móvil la
// selección granular se hace por toque (clic alterna), no con marquee.
const calRootEl = ref(null)
const selectMarquee = ref(null) // { x0, y0, x1, y1 } | null
let _marqueeMoved = false
let _marqueeJustEnded = false // suprime el click de toggle tras un lazo con arrastre

const marqueeStyle = computed(() => {
  const m = selectMarquee.value
  if (!m) return null
  return {
    left: Math.min(m.x0, m.x1) + 'px',
    top: Math.min(m.y0, m.y1) + 'px',
    width: Math.abs(m.x1 - m.x0) + 'px',
    height: Math.abs(m.y1 - m.y0) + 'px',
  }
})

const onMarqueeMove = (e) => {
  if (!selectMarquee.value) return
  selectMarquee.value = { ...selectMarquee.value, x1: e.clientX, y1: e.clientY }
  if (Math.abs(e.clientX - selectMarquee.value.x0) > 3 ||
      Math.abs(e.clientY - selectMarquee.value.y0) > 3) _marqueeMoved = true
}

const onMarqueeEnd = () => {
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeEnd)
  const m = selectMarquee.value
  selectMarquee.value = null
  if (!m || !_marqueeMoved) { _marqueeMoved = false; return }
  _marqueeMoved = false
  // El lazo arrastró → suprimir el @click de toggle que sigue (si arrancó encima
  // de una ventana/grupo), para no alternar esa ventana además de lo seleccionado.
  _marqueeJustEnded = true
  const rx0 = Math.min(m.x0, m.x1), rx1 = Math.max(m.x0, m.x1)
  const ry0 = Math.min(m.y0, m.y1), ry1 = Math.max(m.y0, m.y1)
  const ids = new Set(props.selectedWindowIds)
  const root = calRootEl.value
  const hits = (r) => r.left < rx1 && r.right > rx0 && r.top < ry1 && r.bottom > ry0
  if (root) {
    // Ventanas individuales: agarrar por intersección real (toque, no rango).
    for (const el of root.querySelectorAll('[data-window-id]')) {
      if (hits(el.getBoundingClientRect())) ids.add(el.dataset.windowId)
    }
    // Bloques de GRUPO (ventanas con rango idéntico): agarran TODAS sus ventanas.
    for (const el of root.querySelectorAll('[data-window-ids]')) {
      if (hits(el.getBoundingClientRect())) {
        for (const id of el.dataset.windowIds.split(',')) if (id) ids.add(id)
      }
    }
  }
  emit('selection-change', ids)
}

const startMarquee = (x, y) => {
  selectMarquee.value = { x0: x, y0: y, x1: x, y1: y }
  _marqueeMoved = false
  window.addEventListener('mousemove', onMarqueeMove)
  window.addEventListener('mouseup', onMarqueeEnd)
}

const onCellMousedown = (dayIdx, slot, e) => {
  if (!props.selectable) return
  if (e && e.button === 2) return // ignore right-click
  if (props.activeTool === 'eraser') {
    onEraserStart(dayIdx, slot)
    return
  }
  if (props.activeTool === 'select') {
    // Marquee 2D real (coords de cliente), rastreado a nivel window.
    if (e) startMarquee(e.clientX, e.clientY)
    return
  }
  // Block creation drag on past cells (default tool only)
  const cellDate = props.weekDates[dayIdx]
  if (cellDate && cellDate < todayStr.value) return
  if (cellDate === todayStr.value) {
    const slotEndMins = Math.floor(slot / 2) * 60 + ((slot % 2) + 1) * 30
    const nowMins = now.value.getHours() * 60 + now.value.getMinutes()
    if (slotEndMins <= nowMins) return
  }
  dragging.value = true
  dragStartDay.value = dayIdx
  dragStartSlot.value = slot
  dragEndDay.value = dayIdx
  dragEndSlot.value = slot
}

const onCellMouseenter = (dayIdx, slot) => {
  if (erasing.value) { onEraserMove(dayIdx, slot); return }
  if (!dragging.value) return
  dragEndDay.value = dayIdx
  dragEndSlot.value = slot
}

// El arrastre por celdas es SOLO para crear (herramienta normal). La selección
// usa el marquee 2D por píxeles (startMarquee/onMarqueeEnd), no esta vía.
const onMouseup = () => {
  if (!dragging.value) return
  const startH = Math.floor(selSlotMin.value / 2)
  const startM = (selSlotMin.value % 2) * 30
  const endH = Math.floor(selSlotMax.value / 2)
  const endM = (selSlotMax.value % 2) * 30

  const days = []
  for (let d = selDayMin.value; d <= selDayMax.value; d++) {
    days.push({ dayIndex: d, date: props.weekDates[d] })
  }
  emit('range-selected', {
    days,
    dayIndex: days[0].dayIndex,
    date: days[0].date,
    startHour: startH + startM / 60,
    endHour: endH + endM / 60,
  })
  dragging.value = false
  dragStartDay.value = -1
  dragEndDay.value = -1
}

const cancelDrag = () => {
  dragging.value = false
  dragStartDay.value = -1
  dragEndDay.value = -1
}

// ---- Touch / mobile tap support ----
let touchTimer = null
const touchActive = ref(false)
let blockDragTimer = null   // long-press timer for mobile block/group drag
let _pendingDrag = null     // { type, w|group, dayIdx, startX, startY }

// Móvil: un solo toque en una celda vacía abre la vista de crear (estilo Google
// Calendar). Sin doble-tap ni recuadro fantasma de "toca de nuevo".
const onCellTap = (dayIdx, slot) => {
  if (!props.selectable || !props.isMobile) return

  // Block taps on past cells
  const cellDate = props.weekDates[dayIdx]
  if (cellDate && cellDate < todayStr.value) return
  if (cellDate === todayStr.value) {
    const slotEndMins = Math.floor(slot / 2) * 60 + ((slot % 2) + 1) * 30
    const nowMins = now.value.getHours() * 60 + now.value.getMinutes()
    if (slotEndMins <= nowMins) return
  }

  const startH = Math.floor(slot / 2)
  const startM = (slot % 2) * 30
  const endSlot = slot + 2 // default 1-hour selection
  const endH = Math.floor(endSlot / 2)
  const endM = (endSlot % 2) * 30
  emit('range-selected', {
    days: [{ dayIndex: dayIdx, date: props.weekDates[dayIdx] }],
    dayIndex: dayIdx,
    date: props.weekDates[dayIdx],
    startHour: startH + startM / 60,
    endHour: endH + endM / 60,
  })
}

// Coordenadas del toque inicial para distinguir tap de scroll/swipe.
let cellTapStartX = 0, cellTapStartY = 0

const onCellTouchstart = (dayIdx, slot, e) => {
  if (!props.selectable) return
  // Eraser and select tools work on mobile too — handle before isMobile guard
  if (props.activeTool === 'eraser') {
    onEraserStart(dayIdx, slot)
    return
  }
  if (props.activeTool === 'select') {
    // En móvil la selección granular es por TOQUE en cada ventana (clic alterna),
    // no con marquee (evita chocar con el swipe de navegación). Tocar una celda
    // vacía en modo select no hace nada.
    return
  }
  if (props.isMobile) {
    // On mobile with default tool, use tap-based creation (handled in onCellTouchendTap)
    cellTapStartX = e.touches?.[0]?.clientX ?? 0
    cellTapStartY = e.touches?.[0]?.clientY ?? 0
    return
  }
  // Desktop touch: long-press to start drag
  touchTimer = setTimeout(() => {
    touchActive.value = true
    onCellMousedown(dayIdx, slot)
  }, 300)
}

const onCellTouchendTap = (dayIdx, slot, e) => {
  if (!props.selectable || !props.isMobile) return
  if (props.activeTool === 'eraser' || props.activeTool === 'select') return
  // Si el dedo se movió (scroll vertical / swipe), no fue un tap → no crear.
  const t = e.changedTouches?.[0]
  if (t && (Math.abs(t.clientX - cellTapStartX) > 10 || Math.abs(t.clientY - cellTapStartY) > 10)) return
  onCellTap(dayIdx, slot)
}

const onTouchmove = (e) => {
  // Cancel pending block/group drag — user is scrolling, not long-pressing
  if (blockDragTimer !== null) {
    clearTimeout(blockDragTimer)
    blockDragTimer = null
    _pendingDrag = null
  }
  // Navigation pan tracking for day mode (before drag checks)
  if (showSingleDay.value && !blockDragging.value && !resizing.value && !panBusy) {
    onCalSwipeMove(e)
    if (panLock.value === 'h') return // horizontal pan active — skip drag processing
  }
  // If the long-press hasn't activated yet, user is scrolling — cancel and don't interfere
  if (!touchActive.value && !dragging.value && !blockDragging.value && !resizing.value && !hExpanding.value && !erasing.value) {
    if (touchTimer) {
      clearTimeout(touchTimer)
      touchTimer = null
    }
    return // Don't call preventDefault — let native scroll work
  }
  if (!dragging.value && !blockDragging.value && !resizing.value && !hExpanding.value && !erasing.value) return
  // Only prevent scroll when drag is confirmed
  if (e.cancelable) e.preventDefault()
  if (blockDragging.value || resizing.value) { onBlockDragMove(e); return }
  if (hExpanding.value) { onHExpandMove(e); return }
  if (erasing.value) {
    const clientX = e.touches[0]?.clientX
    const clientY = e.touches[0]?.clientY
    if (clientX != null && clientY != null) {
      const elements = document.elementsFromPoint(clientX, clientY)
      const cell = elements.find(el => el.dataset.slot !== undefined)
      if (cell) {
        onEraserMove(parseInt(cell.dataset.day), parseInt(cell.dataset.slot))
      }
    }
    return
  }
  const clientX = e.touches[0]?.clientX
  const clientY = e.touches[0]?.clientY
  if (clientX == null || clientY == null) return
  const elements = document.elementsFromPoint(clientX, clientY)
  const cell = elements.find(el => el.dataset.slot !== undefined)
  if (cell) {
    dragEndDay.value = parseInt(cell.dataset.day)
    dragEndSlot.value = parseInt(cell.dataset.slot)
  }
}

const onTouchend = () => {
  if (touchTimer) { clearTimeout(touchTimer); touchTimer = null }
  if (blockDragTimer !== null) { clearTimeout(blockDragTimer); blockDragTimer = null; _pendingDrag = null }
  touchActive.value = false
  touchOnBlock = false
  onMouseup()
  onBlockDragEnd()
  onResizeEnd()
  onHExpandEnd()
  onEraserEnd()
}

// ---- Block drag (reschedule) ----
const blockDragging = ref(false)
const draggedWindow = ref(null)
const draggedGroup = ref(null)
const draggedOriginDay = ref(-1)
const draggedTargetDay = ref(-1)
const draggedTargetSlot = ref(0)
let dragGrabOffset = 0 // slots between cursor and block start
let blockDragMoved = false // true if mouse actually moved during drag
const batchDragging = ref(false) // true when dragging selected windows together

// §4 de las reglas: con el turno iniciado el inicio queda congelado — mover el
// bloque cambiaría starts_at, así que el drag ni se inicia. El fin se ajusta
// con el handle inferior. Usa la Timeline del servidor.
const _isSealedWindow = (w) => {
  const src = w?._originalWindow || w
  return !!src?.startsAt && WorkWindow.timelineNow() >= new Date(src.startsAt).getTime()
}

const onBlockDragStart = (w, dayIdx, e) => {
  if (!props.selectable) return
  if (props.activeTool === 'eraser') return
  if (_isSealedWindow(w) && props.activeTool !== 'select') return
  if (props.activeTool === 'select') {
    const id = (w._originalWindow || w).id
    // No seleccionada → arrancar el LAZO aquí mismo (poder seleccionar también
    // empezando encima de ventanas, no solo en celdas vacías). Un click sin
    // arrastre la alterna (onBlockClick); arrastrar lazo-selecciona por roce.
    if (!props.selectedWindowIds.has(id)) {
      if (e && e.clientX != null) startMarquee(e.clientX, e.clientY)
      return
    }
    // Ya seleccionada → arrastrar el lote (mover juntas).
    e.stopPropagation()
    blockDragging.value = true
    batchDragging.value = true
    blockDragMoved = false
    draggedWindow.value = w
    draggedGroup.value = null
    draggedOriginDay.value = dayIdx
    draggedTargetDay.value = dayIdx
    draggedTargetSlot.value = Math.round(w.startHour * 2)
    const clientY = e.touches ? e.touches[0]?.clientY : e.clientY
    const elements = document.elementsFromPoint(e.clientX ?? e.touches?.[0]?.clientX ?? 0, clientY)
    const cell = elements.find(el => el.dataset.slot !== undefined)
    const clickedSlot = cell ? parseInt(cell.dataset.slot) : Math.round(w.startHour * 2)
    dragGrabOffset = clickedSlot - Math.round(w.startHour * 2)
    return
  }
  e.stopPropagation()
  blockDragging.value = true
  blockDragMoved = false
  // If this window is part of a batch selection, drag all selected windows
  const wId = (w._originalWindow || w).id
  batchDragging.value = props.selectedWindowIds.has(wId) && props.selectedWindowIds.size > 1
  draggedWindow.value = w
  draggedGroup.value = null
  draggedOriginDay.value = dayIdx
  draggedTargetDay.value = dayIdx
  draggedTargetSlot.value = Math.round(w.startHour * 2)

  // Calculate grab offset: which slot did the user click?
  const clientY = e.touches ? e.touches[0]?.clientY : e.clientY
  const elements = document.elementsFromPoint(e.clientX ?? e.touches?.[0]?.clientX ?? 0, clientY)
  const cell = elements.find(el => el.dataset.slot !== undefined)
  const clickedSlot = cell ? parseInt(cell.dataset.slot) : Math.round(w.startHour * 2)
  dragGrabOffset = clickedSlot - Math.round(w.startHour * 2)
}

const onGroupDragStart = (group, dayIdx, e) => {
  if (!props.selectable) return
  // §4: grupo sellado (todas comparten inicio) = inmutable — el drag ni se inicia.
  if (_isSealedWindow(group.windows?.[0]) && props.activeTool !== 'select') return
  if (props.activeTool === 'select') {
    // Si ninguna del grupo está seleccionada → arrancar el lazo aquí; si alguna
    // lo está → permitir arrastrar el lote (cae al flujo normal de abajo).
    const anySelected = group.windows.some(w => props.selectedWindowIds.has(w.id))
    if (!anySelected) {
      if (e && e.clientX != null) startMarquee(e.clientX, e.clientY)
      return
    }
  }
  e.stopPropagation()
  blockDragging.value = true
  blockDragMoved = false
  draggedGroup.value = group
  draggedWindow.value = { startHour: group.startHour, endHour: group.endHour }
  draggedOriginDay.value = dayIdx
  draggedTargetDay.value = dayIdx
  draggedTargetSlot.value = Math.round(group.startHour * 2)

  // If any window from this group is in the selection, treat as batch drag
  const hasSelected = group.windows.some(w => props.selectedWindowIds.has(w.id))
  batchDragging.value = hasSelected && props.selectedWindowIds.size > 0

  const clientY = e.touches ? e.touches[0]?.clientY : e.clientY
  const elements = document.elementsFromPoint(e.clientX ?? e.touches?.[0]?.clientX ?? 0, clientY)
  const cell = elements.find(el => el.dataset.slot !== undefined)
  const clickedSlot = cell ? parseInt(cell.dataset.slot) : Math.round(group.startHour * 2)
  dragGrabOffset = clickedSlot - Math.round(group.startHour * 2)
}

const onBlockDragMove = (e) => {
  if (hExpanding.value) { onHExpandMove(e); return }
  if (resizing.value) { onResizeMove(e); return }
  if (!blockDragging.value) return
  const clientX = e.touches ? e.touches[0]?.clientX : e.clientX
  const clientY = e.touches ? e.touches[0]?.clientY : e.clientY
  if (clientX == null || clientY == null) return
  const elements = document.elementsFromPoint(clientX, clientY)
  const cell = elements.find(el => el.dataset.slot !== undefined)
  if (cell) {
    const newDay = parseInt(cell.dataset.day)
    const newSlot = Math.max(0, parseInt(cell.dataset.slot) - dragGrabOffset)
    if (newDay !== draggedTargetDay.value || newSlot !== draggedTargetSlot.value) {
      blockDragMoved = true
    }
    draggedTargetDay.value = newDay
    draggedTargetSlot.value = newSlot
  }
}

const blockDragGhostStyle = computed(() => {
  if (!blockDragging.value || !draggedWindow.value) return null
  const duration = draggedWindow.value.endHour - draggedWindow.value.startHour
  return {
    top: draggedTargetSlot.value * SLOT_H.value + 'px',
    height: duration * HOUR_H.value + 'px',
  }
})

const compactBlockDragGhostStyle = computed(() => {
  if (!blockDragging.value || !draggedWindow.value) return null
  const duration = draggedWindow.value.endHour - draggedWindow.value.startHour
  return {
    top: draggedTargetSlot.value * COMPACT_SLOT_H + 'px',
    height: duration * COMPACT_HOUR_H + 'px',
  }
})

const onBlockTouchstart = (w, dayIdx, e) => {
  // Capture swipe start even when touching a block (for day-mode pan)
  if (e.touches[0]) {
    swipeStartX = e.touches[0].clientX
    swipeStartY = e.touches[0].clientY
    panLock.value = null
    panX.value = 0
  }
  touchOnBlock = true
  onWindowLongPress(w, e)
  if (props.isMobile) {
    const startX = e.touches[0]?.clientX ?? 0
    const startY = e.touches[0]?.clientY ?? 0
    _pendingDrag = { type: 'window', w, dayIdx, startX, startY }
    blockDragTimer = setTimeout(() => {
      const pd = _pendingDrag
      blockDragTimer = null
      _pendingDrag = null
      if (!pd || pd.type !== 'window') return
      blockDragging.value = true
      blockDragMoved = false
      batchDragging.value = false
      draggedWindow.value = pd.w
      draggedGroup.value = null
      draggedOriginDay.value = pd.dayIdx
      draggedTargetDay.value = pd.dayIdx
      draggedTargetSlot.value = Math.round(pd.w.startHour * 2)
      const els = document.elementsFromPoint(pd.startX, pd.startY)
      const cell = els.find(el => el.dataset.slot !== undefined)
      dragGrabOffset = cell ? parseInt(cell.dataset.slot) - Math.round(pd.w.startHour * 2) : 0
    }, 300)
  } else {
    onBlockDragStart(w, dayIdx, e)
  }
}

const onGroupTouchstart = (group, dayIdx, e) => {
  // Capture swipe start even when touching a group block (for day-mode pan)
  if (e.touches[0]) {
    swipeStartX = e.touches[0].clientX
    swipeStartY = e.touches[0].clientY
    panLock.value = null
    panX.value = 0
  }
  touchOnBlock = true
  onGroupLongPress(group, e)
  if (props.isMobile) {
    const startX = e.touches[0]?.clientX ?? 0
    const startY = e.touches[0]?.clientY ?? 0
    _pendingDrag = { type: 'group', group, dayIdx, startX, startY }
    blockDragTimer = setTimeout(() => {
      const pd = _pendingDrag
      blockDragTimer = null
      _pendingDrag = null
      if (!pd || pd.type !== 'group') return
      blockDragging.value = true
      blockDragMoved = false
      draggedGroup.value = pd.group
      draggedWindow.value = { startHour: pd.group.startHour, endHour: pd.group.endHour }
      draggedOriginDay.value = pd.dayIdx
      draggedTargetDay.value = pd.dayIdx
      draggedTargetSlot.value = Math.round(pd.group.startHour * 2)
      const hasSelected = pd.group.windows.some(w => props.selectedWindowIds.has(w.id))
      batchDragging.value = hasSelected && props.selectedWindowIds.size > 0
      const els = document.elementsFromPoint(pd.startX, pd.startY)
      const cell = els.find(el => el.dataset.slot !== undefined)
      dragGrabOffset = cell ? parseInt(cell.dataset.slot) - Math.round(pd.group.startHour * 2) : 0
    }, 300)
  } else {
    onGroupDragStart(group, dayIdx, e)
  }
}

const onBlockDragEnd = () => {
  if (!blockDragging.value) return
  const w = draggedWindow.value
  const group = draggedGroup.value
  const targetDay = draggedTargetDay.value
  const targetSlot = draggedTargetSlot.value
  const originDay = draggedOriginDay.value
  const wasBatchDrag = batchDragging.value

  blockDragging.value = false
  draggedWindow.value = null
  draggedGroup.value = null
  batchDragging.value = false

  if (!w) return

  const targetDate = props.weekDates[targetDay]
  const startH = Math.floor(targetSlot / 2)
  const startM = (targetSlot % 2) * 30
  const duration = w.endHour - w.startHour
  const endDecimal = startH + startM / 60 + duration
  const endH = Math.floor(endDecimal)
  const endM = Math.round((endDecimal % 1) * 60)

  const newStartHour = startH + startM / 60
  const originDate = props.weekDates[originDay]

  if (wasBatchDrag) {
    const deltaHours = newStartHour - w.startHour
    if (deltaHours === 0 && targetDate === originDate) return
    emit('batch-reschedule', {
      ids: [...props.selectedWindowIds],
      targetDate,
      deltaHours,
    })
    return
  }

  if (group) {
    const deltaHours = newStartHour - group.startHour
    // No movement → don't emit
    if (deltaHours === 0 && targetDate === originDate) return
    emit('group-reschedule', {
      group,
      targetDate,
      deltaHours,
    })
  } else {
    // No movement → don't emit (user just clicked)
    if (Math.abs(newStartHour - w.startHour) < 0.01 && targetDate === originDate) return
    emit('reschedule', {
      window: w._originalWindow || w,
      targetDate,
      startTime: fmtHM(startH, startM),
      endTime: fmtHM(endH, endM),
    })
  }
}

// ---- Block resize (stretch top/bottom edge) ----
const resizing = ref(false)
const resizeWindow = ref(null)
const resizeGroup = ref(null) // non-null when resizing a group
const resizeDirection = ref(null) // 'top' | 'bottom'
const resizeDayIdx = ref(-1)
const resizeSlot = ref(0)

const onResizeStart = (w, dayIdx, { direction, event }) => {
  if (!props.selectable) return
  if (direction === 'left' || direction === 'right') {
    onHExpandStart(w, dayIdx, direction, event)
    return
  }
  event.stopPropagation()
  event.preventDefault()
  resizing.value = true
  resizeWindow.value = w
  resizeGroup.value = null
  resizeDirection.value = direction
  resizeDayIdx.value = dayIdx
  resizeSlot.value = direction === 'top'
    ? Math.round(w.startHour * 2)
    : Math.round(w.endHour * 2)
}

const onGroupResizeStart = (group, dayIdx, { direction, event }) => {
  if (!props.selectable) return
  event.stopPropagation()
  event.preventDefault()
  resizing.value = true
  resizeGroup.value = group
  resizeWindow.value = null
  resizeDirection.value = direction
  resizeDayIdx.value = dayIdx
  resizeSlot.value = direction === 'top'
    ? Math.round(group.startHour * 2)
    : Math.round(group.endHour * 2)
}

const onResizeMove = (e) => {
  if (!resizing.value) return
  const clientX = e.touches ? e.touches[0]?.clientX : e.clientX
  const clientY = e.touches ? e.touches[0]?.clientY : e.clientY
  if (clientX == null || clientY == null) return
  const elements = document.elementsFromPoint(clientX, clientY)
  const cell = elements.find(el => el.dataset.slot !== undefined)
  if (cell) {
    resizeSlot.value = parseInt(cell.dataset.slot)
  }
}

// Delta in slots being applied during resize (live, for batch preview)
const resizeDeltaSlots = computed(() => {
  if (!resizing.value) return 0
  const source = resizeWindow.value || resizeGroup.value
  if (!source) return 0
  const startHour = source.startHour
  const endHour = source.endHour
  if (resizeDirection.value === 'top') {
    return resizeSlot.value - Math.round(startHour * 2)
  } else {
    return (resizeSlot.value + 1) - Math.round(endHour * 2)
  }
})

const resizeGhostStyle = computed(() => {
  if (!resizing.value) return null
  const source = resizeWindow.value || resizeGroup.value
  if (!source) return null
  const startHour = source.startHour
  const endHour = source.endHour
  let topSlot, bottomSlot
  if (resizeDirection.value === 'top') {
    topSlot = Math.min(resizeSlot.value, Math.round(endHour * 2) - 1)
    bottomSlot = Math.round(endHour * 2)
  } else {
    topSlot = Math.round(startHour * 2)
    bottomSlot = Math.max(resizeSlot.value + 1, topSlot + 1)
  }
  return {
    top: topSlot * SLOT_H.value + 'px',
    height: (bottomSlot - topSlot) * SLOT_H.value + 'px',
  }
})

// Ghosts for all OTHER selected windows during batch resize (Map<dayIdx, style[]>)
const batchResizeGhosts = computed(() => {
  if (!resizing.value || props.selectedWindowIds.size < 2) return null
  const source = resizeWindow.value || resizeGroup.value
  if (!source) return null
  const sourceId = resizeGroup.value
    ? null
    : (resizeWindow.value._originalWindow || resizeWindow.value).id
  const touchesSelection = resizeGroup.value
    ? resizeGroup.value.windows.some(gw => props.selectedWindowIds.has(gw.id))
    : props.selectedWindowIds.has(sourceId)
  if (!touchesSelection) return null

  const delta = resizeDeltaSlots.value
  if (delta === 0) return null

  const dir = resizeDirection.value
  const map = new Map()
  for (const w of props.windows) {
    if (!props.selectedWindowIds.has(w.id)) continue
    // Skip the window being directly resized (it already has its own ghost)
    if (w.id === sourceId) continue
    const dayIdx = props.weekDates.indexOf(w.scheduledDate)
    if (dayIdx === -1) continue

    const origStart = Math.round(w.startHour * 2)
    const origEnd = Math.round(w.endHour * 2)
    let topSlot, bottomSlot
    if (dir === 'top') {
      topSlot = Math.min(origStart + delta, origEnd - 1)
      bottomSlot = origEnd
    } else {
      topSlot = origStart
      bottomSlot = Math.max(origEnd + delta, origStart + 1)
    }
    const style = {
      top: topSlot * SLOT_H.value + 'px',
      height: (bottomSlot - topSlot) * SLOT_H.value + 'px',
    }
    if (!map.has(dayIdx)) map.set(dayIdx, [])
    map.get(dayIdx).push(style)
  }
  return map
})

let resizeJustEnded = false
const onResizeEnd = () => {
  if (!resizing.value) return
  resizeJustEnded = true
  const w = resizeWindow.value
  const group = resizeGroup.value
  const dir = resizeDirection.value
  const slot = resizeSlot.value

  resizing.value = false
  resizeWindow.value = null
  resizeGroup.value = null
  resizeDirection.value = null

  const source = w || group
  if (!source) return

  const startHour = source.startHour ?? source.startHour
  const endHour = source.endHour ?? source.endHour

  let startSlot = Math.round(startHour * 2)
  let endSlot = Math.round(endHour * 2)

  if (dir === 'top') {
    startSlot = Math.min(slot, endSlot - 1)
  } else {
    endSlot = Math.max(slot + 1, startSlot + 1)
  }

  const sH = Math.floor(startSlot / 2)
  const sM = (startSlot % 2) * 30
  const eH = Math.floor(endSlot / 2)
  const eM = (endSlot % 2) * 30

  // Only emit if something changed
  if (startSlot === Math.round(startHour * 2) && endSlot === Math.round(endHour * 2)) return

  // Check if the resized block (single or group) overlaps with the selection
  const deltaSlots = dir === 'top'
    ? startSlot - Math.round(startHour * 2)
    : endSlot - Math.round(endHour * 2)

  const touchesSelection = group
    ? group.windows.some(gw => props.selectedWindowIds.has(gw.id))
    : props.selectedWindowIds.has((w._originalWindow || w).id)

  if (props.selectedWindowIds.size > 1 && touchesSelection) {
    emit('batch-resize', {
      ids: [...props.selectedWindowIds],
      direction: dir,
      deltaSlots,
    })
  } else if (group) {
    const gPayload = { group }
    if (dir === 'top') gPayload.startTime = fmtHM(sH, sM)
    else gPayload.endTime = fmtHM(eH, eM)
    emit('group-resize', gPayload)
  } else {
    const payload = { window: w._originalWindow || w }
    if (dir === 'top') {
      payload.startTime = fmtHM(sH, sM)
    } else {
      payload.endTime = fmtHM(eH, eM)
    }
    emit('resize', payload)
  }
}

// ---- Horizontal expand (stretch left/right across days) ----
const hExpanding = ref(false)
const hExpandWindow = ref(null)
const hExpandDirection = ref(null) // 'left' | 'right'
const hExpandOriginDay = ref(-1)
const hExpandTargetDay = ref(-1)

const onHExpandStart = (w, dayIdx, direction, event) => {
  if (!props.selectable) return
  event.stopPropagation()
  event.preventDefault()
  hExpanding.value = true
  hExpandWindow.value = w._originalWindow || w
  hExpandDirection.value = direction
  hExpandOriginDay.value = dayIdx
  hExpandTargetDay.value = dayIdx
}

const onHExpandMove = (e) => {
  if (!hExpanding.value) return
  const clientX = e.touches ? e.touches[0]?.clientX : e.clientX
  const clientY = e.touches ? e.touches[0]?.clientY : e.clientY
  if (clientX == null || clientY == null) return
  const elements = document.elementsFromPoint(clientX, clientY)
  const cell = elements.find(el => el.dataset.day !== undefined)
  if (cell) {
    const day = parseInt(cell.dataset.day)
    if (hExpandDirection.value === 'right' && day >= hExpandOriginDay.value) {
      hExpandTargetDay.value = day
    } else if (hExpandDirection.value === 'left' && day <= hExpandOriginDay.value) {
      hExpandTargetDay.value = day
    }
  }
}

const onHExpandEnd = () => {
  if (!hExpanding.value) return
  const w = hExpandWindow.value
  const dir = hExpandDirection.value
  const origin = hExpandOriginDay.value
  const target = hExpandTargetDay.value

  hExpanding.value = false
  hExpandWindow.value = null
  hExpandDirection.value = null
  hExpandJustEnded = true
  setTimeout(() => { hExpandJustEnded = false }, 50)

  if (origin === target || !w) return

  const dates = []
  if (dir === 'right') {
    for (let d = origin + 1; d <= target; d++) dates.push(props.weekDates[d])
  } else {
    for (let d = target; d < origin; d++) dates.push(props.weekDates[d])
  }
  if (dates.length === 0) return

  emit('horizontal-expand', { window: w, direction: dir, dates })
}

const hExpandHighlight = computed(() => {
  if (!hExpanding.value || !hExpandWindow.value) return {}
  const min = Math.min(hExpandOriginDay.value, hExpandTargetDay.value)
  const max = Math.max(hExpandOriginDay.value, hExpandTargetDay.value)
  const w = hExpandWindow.value
  const top = (w.startHour - BASE_HOUR) * HOUR_H.value
  const height = (w.endHour - w.startHour) * HOUR_H.value
  const set = {}
  for (let d = min; d <= max; d++) {
    if (d !== hExpandOriginDay.value) set[d] = { top, height }
  }
  return set
})

// ---- Eraser tool ----
const erasing = ref(false)
const eraseStartDay = ref(-1)
const eraseEndDay = ref(-1)
const eraseStartSlot = ref(0)
const eraseEndSlot = ref(0)

const eraseDayMin = computed(() => Math.min(eraseStartDay.value, eraseEndDay.value))
const eraseDayMax = computed(() => Math.max(eraseStartDay.value, eraseEndDay.value))

const onEraserStart = (dayIdx, slot) => {
  erasing.value = true
  eraseStartDay.value = dayIdx
  eraseEndDay.value = dayIdx
  eraseStartSlot.value = slot
  eraseEndSlot.value = slot
}

const onEraserMove = (dayIdx, slot) => {
  if (!erasing.value) return
  eraseEndDay.value = dayIdx
  eraseEndSlot.value = slot
}

const onEraserEnd = () => {
  if (!erasing.value) return
  erasing.value = false
  const minSlot = Math.min(eraseStartSlot.value, eraseEndSlot.value)
  const maxSlot = Math.max(eraseStartSlot.value, eraseEndSlot.value) + 1
  const dates = []
  for (let d = eraseDayMin.value; d <= eraseDayMax.value; d++) {
    dates.push(props.weekDates[d])
  }
  emit('erase', {
    dates,
    startTime: fmtSlotTime(minSlot),
    endTime: fmtSlotTime(maxSlot),
  })
}

const eraseGhostStyle = computed(() => {
  if (!erasing.value) return null
  const minSlot = Math.min(eraseStartSlot.value, eraseEndSlot.value)
  const maxSlot = Math.max(eraseStartSlot.value, eraseEndSlot.value) + 1
  return {
    top: minSlot * SLOT_H.value + 'px',
    height: (maxSlot - minSlot) * SLOT_H.value + 'px',
  }
})

// ---- Compact ghost styles (use COMPACT_SLOT_H) ----
const compactSelectionStyle = computed(() => {
  if (!dragging.value) return null
  return {
    top: selSlotMin.value * COMPACT_SLOT_H + 'px',
    height: (selSlotMax.value - selSlotMin.value) * COMPACT_SLOT_H + 'px',
  }
})

const compactEraseGhostStyle = computed(() => {
  if (!erasing.value) return null
  const minSlot = Math.min(eraseStartSlot.value, eraseEndSlot.value)
  const maxSlot = Math.max(eraseStartSlot.value, eraseEndSlot.value) + 1
  return {
    top: minSlot * COMPACT_SLOT_H + 'px',
    height: (maxSlot - minSlot) * COMPACT_SLOT_H + 'px',
  }
})

// ---- Selection tool ----
let lastSelectedId = null

const onSelectClick = (w, e) => {
  const id = (w._originalWindow || w).id
  const ids = new Set(props.selectedWindowIds)

  if (e.shiftKey && lastSelectedId) {
    // Range select: select all windows between last and current
    const allWindows = props.windows
    const lastIdx = allWindows.findIndex(x => x.id === lastSelectedId)
    const currIdx = allWindows.findIndex(x => x.id === id)
    if (lastIdx !== -1 && currIdx !== -1) {
      const [from, to] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx]
      for (let i = from; i <= to; i++) ids.add(allWindows[i].id)
    }
  } else {
    // Clic/tap simple → ALTERNAR esta ventana (selección granular sin Ctrl).
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
  }

  lastSelectedId = id
  emit('selection-change', ids)
}

// ---- Column resize (Outlook-style drag divider) ----
const colWeights = ref([])

watch(() => props.weekDates.length, (len) => {
  colWeights.value = Array(len).fill(1)
}, { immediate: true })

const gridColumns = computed(() => {
  if (colWeights.value.length === 0) return undefined
  const cols = colWeights.value.map(w => `${w}fr`).join(' ')
  return `3.5rem ${cols}`
})

let colResizeStartX = 0
let colResizeStartWeights = []
const colResizeActive = ref(false)
const colResizeIdx = ref(-1)

const onColResizeStart = (idx, e) => {
  colResizeActive.value = true
  colResizeIdx.value = idx
  colResizeStartX = e.clientX
  colResizeStartWeights = [...colWeights.value]
  document.addEventListener('mousemove', onColResizeMove)
  document.addEventListener('mouseup', onColResizeEnd)
}

const onColResizeMove = (e) => {
  if (colResizeIdx.value < 0) return
  const idx = colResizeIdx.value
  const dx = e.clientX - colResizeStartX

  const container = scrollContainer.value
  const gutterPx = 56
  const totalWidth = container ? container.clientWidth - gutterPx : 800
  const totalFr = colResizeStartWeights.reduce((a, b) => a + b, 0)
  const perFrPx = totalWidth / totalFr

  const deltaFr = dx / perFrPx
  const minWeight = 0.3

  const newWeights = [...colResizeStartWeights]
  newWeights[idx] = Math.max(minWeight, colResizeStartWeights[idx] + deltaFr)
  if (idx + 1 < newWeights.length) {
    newWeights[idx + 1] = Math.max(minWeight, colResizeStartWeights[idx + 1] - deltaFr)
  }

  colWeights.value = newWeights
}

const onColResizeEnd = () => {
  colResizeActive.value = false
  colResizeIdx.value = -1
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', onColResizeEnd)
}

const onColResizeDblclick = () => {
  colWeights.value = Array(props.weekDates.length).fill(1)
}

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
  const el = scrollContainer.value
  if (el) el.removeEventListener('scroll', onScrollContainer)
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', onColResizeEnd)
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeEnd)
})

// ---- Windows by day (supports multi-day windows) ----
const windowsByDay = computed(() => {
  const numDays = props.weekDates.length
  const byDay = Array.from({ length: numDays }, () => [])
  for (const w of props.windows) {
    if (!w.scheduledDate) continue
    if (!w.spansMultipleDays) {
      const dayIdx = props.weekDates.indexOf(w.scheduledDate)
      if (dayIdx !== -1) byDay[dayIdx].push(w)
    } else {
      // Multi-day: place a proxy on each day it covers
      const startIdx = props.weekDates.indexOf(w.scheduledDate)
      const endIdx = props.weekDates.indexOf(w.endDate)
      const first = Math.max(startIdx === -1 ? 0 : startIdx, 0)
      const last = Math.min(endIdx === -1 ? numDays - 1 : endIdx, numDays - 1)
      if (startIdx === -1 && endIdx === -1) continue
      for (let d = first; d <= last; d++) {
        // Expose handles on the edge-visible proxy when the real boundary is off-screen
        const isFirst = d === startIdx || (startIdx === -1 && d === first)
        const isLast = d === endIdx || (endIdx === -1 && d === last)
        byDay[d].push({
          ...w._toRaw(),
          id: w.id,
          _multiDayProxy: true,
          _originalWindow: w,
          _isFirstDay: isFirst,
          _isLastDay: isLast,
          get startHour() { return isFirst ? w.startHour : 0 },
          get endHour() { return isLast ? w.endHour : 24 },
          get startTime() { return isFirst ? w.startTime : '00:00' },
          get endTime() { return isLast ? w.endTime : '24:00' },
          get scheduledDate() { return props.weekDates[d] },
          get isActive() { return w.isActive },
          get timeRange() { return w.timeRange },
          specialistId: w.specialistId,
          applicationId: w.applicationId,
          inheritsOnReopen: w.inheritsOnReopen,
          inheritedFromWindowId: w.inheritedFromWindowId,
        })
      }
    }
  }
  return byDay
})

// Orden de columnas por nombre de especialista (resuelto vía specName, que lee
// props.specialists). El resolver se evalúa al renderizar, cuando specName ya existe.
const groupedByDay = useWindowGroups(windowsByDay, (w) => specName(w))

// Multi-day position for resize handle visibility
const _multiDayPos = (w) => {
  if (!w._multiDayProxy) return null
  if (w._isFirstDay && w._isLastDay) return null // both handles needed
  if (w._isFirstDay) return 'first'
  if (w._isLastDay) return 'last'
  return 'middle'
}
const _groupMultiDayPos = (group) => {
  if (!group.windows.every(w => w._multiDayProxy)) return null
  // All windows are multi-day proxies — derive position from any (all share same day)
  const w = group.windows[0]
  if (w._isFirstDay) return 'first'
  if (w._isLastDay) return 'last'
  return 'middle'
}

// Suppress click after drag — click fires after mouseup on the same element
let hExpandJustEnded = false
const onBlockClick = (w, e) => {
  if (blockDragMoved) { blockDragMoved = false; return }
  if (hExpandJustEnded) { hExpandJustEnded = false; return }
  if (resizeJustEnded) { resizeJustEnded = false; return }
  if (_marqueeJustEnded) { _marqueeJustEnded = false; return }
  if (props.activeTool === 'select' || e.shiftKey || e.ctrlKey || e.metaKey) {
    onSelectClick(w, e)
    return
  }
  emit('select', w._originalWindow || w)
}

// ---- Context menu ----
const onWindowContext = (w, e) => {
  e.preventDefault()
  emit('context-window', { window: w._originalWindow || w, x: e.clientX, y: e.clientY })
}
const onGroupContext = (group, e) => {
  e.preventDefault()
  emit('context-group', { group, x: e.clientX, y: e.clientY })
}
const onCellContext = (dayIdx, slot, e) => {
  e.preventDefault()
  const date = props.weekDates[dayIdx]
  const time = fmtSlotTime(slot)
  emit('context-cell', { date, time, x: e.clientX, y: e.clientY })
}

// ---- Long-press for mobile context menu ----
let longPressTimer = null
let longPressFired = false

const onLongPressStart = (emitFn, e) => {
  // En móvil el long-press se reserva para ARRASTRAR la ventana; el menú
  // contextual flotante se elimina (las acciones viven dentro del detalle).
  // Así el gesto de mover y el menú dejan de cruzarse.
  if (props.isMobile) return
  longPressFired = false
  const touch = e.touches?.[0]
  if (!touch) return
  const x = touch.clientX
  const y = touch.clientY
  longPressTimer = setTimeout(() => {
    longPressFired = true
    emitFn(x, y)
  }, 500)
}

const onLongPressEnd = () => {
  clearTimeout(longPressTimer)
  longPressTimer = null
}

const onLongPressMove = () => {
  clearTimeout(longPressTimer)
  longPressTimer = null
}

const onCellLongPress = (dayIdx, slot, e) => {
  onLongPressStart((x, y) => {
    const date = props.weekDates[dayIdx]
    const time = fmtSlotTime(slot)
    emit('context-cell', { date, time, x, y })
  }, e)
}

const onWindowLongPress = (w, e) => {
  touchOnBlock = true
  onLongPressStart((x, y) => {
    emit('context-window', { window: w._originalWindow || w, x, y })
  }, e)
}

const onGroupLongPress = (group, e) => {
  touchOnBlock = true
  onLongPressStart((x, y) => {
    emit('context-group', { group, x, y })
  }, e)
}

const onGroupClick = (group, e) => {
  if (_marqueeJustEnded) { _marqueeJustEnded = false; return }
  if (blockDragMoved) { blockDragMoved = false; return }
  if (resizeJustEnded) { resizeJustEnded = false; return }
  // Shift/Ctrl+Click on group → select all windows in group
  if (props.activeTool === 'select' || e?.shiftKey || e?.ctrlKey || e?.metaKey) {
    const ids = new Set(props.selectedWindowIds)
    for (const w of group.windows) {
      if ((e?.ctrlKey || e?.metaKey) && ids.has(w.id)) ids.delete(w.id)
      else ids.add(w.id)
    }
    if (group.windows.length > 0) lastSelectedId = group.windows[group.windows.length - 1].id
    emit('selection-change', ids)
    return
  }
  emit('group-select', group)
}

const findSpecialist = (id) => props.specialists.find(u => u.specialistId === id)
const findApp = (id) => props.applications.find(a => a.id === id)
const specName = (w) => findSpecialist(w.specialistId)?.fullName || w.specialistId
// Foto del especialista (URL pública del backend, cacheada por el navegador).
const specAvatar = (w) => findSpecialist(w.specialistId)?.preferences?.avatar_url || null
const specEmoji  = (w) => findSpecialist(w.specialistId)?.preferences?.avatar_emoji || null
const appName = (w) => findApp(w.applicationId)?.name || w.applicationId
const appColor = (w) => { const a = findApp(w.applicationId); return a?.color || a?.theme?.color || null }

// Build a map of windowId → parent label for inheritance indicator
const inheritLabelMap = computed(() => {
  const map = new Map()
  const windowById = new Map()
  for (const w of props.windows) windowById.set(w.id, w)
  for (const w of props.windows) {
    if (!w.inheritedFromWindowId) continue
    const parent = windowById.get(w.inheritedFromWindowId)
    if (parent) {
      const name = specName(parent)
      const time = parent.timeRange
      const date = parent.scheduledDate
      const dayNum = date ? parseInt(date.split('-')[2], 10) : ''
      map.set(w.id, `← ${name} · ${dayNum} ${time}`)
    } else {
      map.set(w.id, '← (otra semana)')
    }
  }
  return map
})
const inheritLabel = (w) => inheritLabelMap.value.get(w.id) || ''


const compactTimeTop = computed(() => {
  const d = now.value
  return (d.getHours() + d.getMinutes() / 60) * COMPACT_HOUR_H
})

const isWeekend = (dayIdx) => dayIdx >= 5
const isHourTop = (slot) => slot % 2 === 0

// ---- Month view ----
const monthWindowsByDate = computed(() => {
  const map = new Map()
  for (const w of props.windows) {
    if (!w.scheduledDate) continue
    if (!map.has(w.scheduledDate)) map.set(w.scheduledDate, [])
    map.get(w.scheduledDate).push(w)
  }
  return map
})

const monthWeeks = computed(() => {
  if (props.viewMode !== 'month' || props.monthDates.length === 0) return []
  // Find max windows in any day for heat scaling
  let maxTotal = 0
  for (const wins of monthWindowsByDate.value.values()) {
    if (wins.length > maxTotal) maxTotal = wins.length
  }

  const result = []
  for (let r = 0; r < 6; r++) {
    const row = []
    for (let c = 0; c < 7; c++) {
      const date = props.monthDates[r * 7 + c]
      if (!date) continue
      const parts = date.split('-')
      const month = parseInt(parts[1], 10) - 1
      const dayNum = parseInt(parts[2], 10)
      const wins = monthWindowsByDate.value.get(date) || []
      let active = 0, inactive = 0
      for (const w of wins) { if (w.isActive) active++; else inactive++ }

      // Collect unique app colors (up to 5 strips)
      const colorSet = new Set()
      const colors = []
      for (const w of wins) {
        if (colors.length >= 5) break
        const a = findApp(w.applicationId)
        const color = a?.color || a?.theme?.color || null
        if (color && !colorSet.has(color)) {
          colorSet.add(color)
          colors.push(color)
        }
      }

      // Time coverage: what fraction of 8am-8pm is covered
      let coveredSlots = 0
      const slotCover = new Uint8Array(24) // each slot = 1 hour
      for (const w of wins) {
        if (!w.isActive) continue
        const s = Math.max(0, Math.floor(w.startHour))
        const e = Math.min(24, Math.ceil(w.endHour))
        for (let h = s; h < e; h++) slotCover[h] = 1
      }
      for (let h = 0; h < 24; h++) coveredSlots += slotCover[h]
      const coverage = coveredSlots / 12 // fraction of 12 working hours

      // Heat intensity (0-1) based on window count relative to max
      const heat = maxTotal > 0 ? wins.length / maxTotal : 0

      // Specialist initials (up to 3)
      const specSet = new Set()
      const specs = []
      for (const w of wins) {
        if (specs.length >= 3) break
        if (specSet.has(w.specialistId)) continue
        specSet.add(w.specialistId)
        const s = findSpecialist(w.specialistId)
        const name = s?.fullName || ''
        const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?'
        specs.push({ id: w.specialistId, initials, name })
      }
      const extraSpecs = specSet.size < new Set(wins.map(w => w.specialistId)).size
        ? new Set(wins.map(w => w.specialistId)).size - specSet.size
        : 0

      row.push({
        date, dayNum, isCurrentMonth: month === props.currentMonth,
        isToday: date === todayStr.value, isWeekend: c >= 5,
        active, inactive, total: wins.length,
        colors, coverage, heat, specs, extraSpecs,
      })
    }
    result.push(row)
  }
  return result
})

// ---- Transition key for slide animation ----
const periodKey = computed(() => {
  if (props.viewMode === 'month') return props.monthDates[0] || ''
  return props.weekDates[0] || ''
})

// ---- Button-navigation enter animation (slideDir set by parent) ----
watch(periodKey, (newKey, oldKey) => {
  if (props.pagerControlled) return
  if (!oldKey || panInitiatedNav || !props.slideDir) return
  const dir = props.slideDir === 'slide-left' ? -1 : 1
  const W = window.innerWidth
  const enterX = dir < 0 ? (W + 40) : -(W + 40)
  const els = _getPanEls()
  if (!els.length) return
  for (const el of els) {
    el.style.transition = 'none'
    el.style.transform = `translateX(${enterX}px)`
  }
  els.forEach(el => void el.offsetWidth)
  for (const el of els) {
    el.style.transition = 'transform 0.2s ease-out'
    el.style.transform = 'translateX(0)'
  }
  setTimeout(() => { els.forEach(el => { el.style.transition = ''; el.style.transform = '' }) }, 220)
}, { flush: 'post' })
</script>

<template>
  <div
    ref="calRootEl"
    class="cal"
    :class="{ 'cal--selectable': selectable, 'cal--eraser': activeTool === 'eraser', 'cal--select-tool': activeTool === 'select' }"
    :data-density="density"
    :style="{ '--cal-text-auto': calAutoText }"
    @mouseleave="cancelDrag"
    @mouseup="onMouseup(); onBlockDragEnd(); onResizeEnd(); onHExpandEnd(); onEraserEnd()"
    @mousemove="onBlockDragMove"
    @touchmove="onTouchmove"
    @touchend="onTouchend"
    @touchstart.passive="showSingleDay && onCalSwipeStart($event)"
  >

    <!-- Marquee de selección 2D (modo select, ratón). Teleport a body: el pager
         aplica transform al track, lo que rompería el position:fixed si quedara
         dentro (se posicionaría relativo al track, fuera de pantalla). En body,
         las coordenadas de cliente quedan correctas y el recuadro SÍ se ve. -->
    <Teleport to="body">
      <div v-if="selectMarquee" class="cal-marquee" :style="marqueeStyle"></div>
    </Teleport>

    <!-- ── MOBILE: vista de 1 día ── -->
    <template v-if="showSingleDay">
      <!-- Nav de días (only when parent sends multiple dates, i.e. mobile week) -->
      <div v-if="weekDates.length > 1" class="cal-mobile-nav">
        <button class="cal-mobile-nav__arrow"
                :disabled="activeMobileDay === 0"
                @click="activeMobileDay--">
          <i class="bx bx-chevron-left"></i>
        </button>

        <div class="cal-mobile-nav__days">
          <button
            v-for="(date, idx) in weekDates"
            :key="idx"
            class="cal-mobile-nav__day"
            :class="{
              'cal-mobile-nav__day--active': idx === activeMobileDay,
              'cal-mobile-nav__day--today': idx === todayIndex
            }"
            @click="activeMobileDay = idx"
          >
            <span class="cal-mobile-nav__label">{{ DAY_LABELS[idx] }}</span>
            <span class="cal-mobile-nav__num">{{ parseInt(date.split('-')[2]) }}</span>
          </button>
        </div>

        <button class="cal-mobile-nav__arrow"
                :disabled="activeMobileDay >= weekDates.length - 1"
                @click="activeMobileDay++">
          <i class="bx bx-chevron-right"></i>
        </button>
      </div>

      <!-- Grid de 1 día -->
      <div ref="scrollContainerDay" class="cal-scroll cal-scroll--day-wrap"
           @touchend.passive="showSingleDay && onCalSwipeEnd($event)">
        <!-- Sticky date pill -->
        <div class="cal-day-pill" :class="{ 'cal-day-pill--visible': dayScrolled }">
          <i class='bx bx-calendar-event'></i>
          <span>{{ activeDayLabel }}</span>
        </div>
        <div class="cal-body cal-body--mobile">

          <!-- Gutter de horas -->
          <div class="cal-gutter">
            <div v-for="slot in SLOTS" :key="slot" class="cal-gutter__cell" :class="{ 'cal-gutter__cell--top': isHourTop(slot) }" :style="{ height: SLOT_H + 'px' }">
              <span v-if="isHourTop(slot)" class="cal-gutter__label">{{ formatHour(slot / 2) }}</span>
            </div>
          </div>

          <!-- Columna del día activo -->
          <div class="cal-col" :class="{ 'cal-col--today': activeMobileDay === todayIndex }">
            <div
              v-for="slot in SLOTS"
              :key="slot"
              class="cal-col__cell"
              :class="{
                'cal-col__cell--top': isHourTop(slot),
                'cal-col__cell--bottom': !isHourTop(slot),
              }"
              :style="{ height: SLOT_H + 'px' }"
              :data-day="activeMobileDay"
              :data-slot="slot"
              @mousedown.prevent="onCellMousedown(activeMobileDay, slot, $event)"
              @mouseenter="onCellMouseenter(activeMobileDay, slot)"
              @contextmenu.prevent="onCellContext(activeMobileDay, slot, $event)"
              @touchstart.passive="onCellTouchstart(activeMobileDay, slot, $event); onCellLongPress(activeMobileDay, slot, $event)"
              @touchend="onCellTouchendTap(activeMobileDay, slot, $event); onLongPressEnd()"
              @touchmove="onLongPressMove()"
            ></div>

            <!-- Línea de tiempo actual -->
            <div v-if="activeMobileDay === todayIndex" class="cal-now"
                 :style="{ top: currentTimeTop + 'px' }">
              <span class="cal-now__dot"></span>
              <span class="cal-now__line"></span>
            </div>

            <!-- Drag preview -->
            <div
              v-if="dragging && isDayInSelection(activeMobileDay)"
              class="cal-drag"
              :style="selectionStyle"
            >
              <span class="cal-drag__label">{{ selectionLabel }}</span>
            </div>

            <!-- Block drag ghost -->
            <div
              v-if="blockDragging && draggedTargetDay === activeMobileDay && blockDragGhostStyle"
              class="cal-drag-ghost"
              :style="blockDragGhostStyle"
            ></div>

            <!-- Resize ghost -->
            <div
              v-if="resizing && resizeDayIdx === activeMobileDay && resizeGhostStyle"
              class="cal-resize-ghost"
              :style="resizeGhostStyle"
            ></div>

            <!-- Batch resize ghosts (other selected windows, mobile) -->
            <template v-if="batchResizeGhosts && batchResizeGhosts.has(activeMobileDay)">
              <div
                v-for="(gs, gi) in batchResizeGhosts.get(activeMobileDay)"
                :key="'brg-m-' + gi"
                class="cal-resize-ghost cal-resize-ghost--batch"
                :style="gs"
              ></div>
            </template>

            <!-- Eraser ghost (mobile) -->
            <div
              v-if="erasing && activeMobileDay >= eraseDayMin && activeMobileDay <= eraseDayMax && eraseGhostStyle"
              class="cal-erase-ghost"
              :style="eraseGhostStyle"
            ></div>

            <!-- Bloques del día activo -->
            <template v-for="item in groupedByDay[activeMobileDay]"
                      :key="item.type === 'group' ? item.id : item.window.id">
              <WindowGroupBlock
                v-if="item.type === 'group'"
                :group="item"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :specialists="specialists"
                :applications="applications"
                :selectable="selectable"
                :multi-day-pos="_groupMultiDayPos(item)"
                :selected-ids="selectedWindowIds"
                :cut-ids="cutWindowIds"
                @click="(_, ev) => onGroupClick(item, ev)"
                @contextmenu.prevent="onGroupContext(item, $event)"
                @touchstart.stop="onGroupTouchstart(item, activeMobileDay, $event)"
                @touchend="onLongPressEnd()"
                @touchmove="onLongPressMove()"
                @mousedown.stop="onGroupDragStart(item, activeMobileDay, $event)"
                @resize-start="onGroupResizeStart(item, activeMobileDay, $event)"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :specialist-avatar="specAvatar(item.window)"
                :specialist-emoji="specEmoji(item.window)"
                :application-name="appName(item.window)"
                :app-color="appColor(item.window)"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :selectable="selectable"
                :multi-day-pos="_multiDayPos(item.window)"
                :selected="selectedWindowIds.has((item.window._originalWindow || item.window).id)"
                :cut="cutWindowIds.has((item.window._originalWindow || item.window).id)"
                :inherited="!!(item.window.inheritedFromWindowId || item.window.inheritsOnReopen)"
                :inherit-label="inheritLabel(item.window)"
                @click="(_, ev) => onBlockClick(item.window, ev)"
                @contextmenu.prevent="onWindowContext(item.window, $event)"
                @touchstart.stop="onBlockTouchstart(item.window, activeMobileDay, $event)"
                @touchend="onLongPressEnd()"
                @touchmove="onLongPressMove()"
                @mousedown.stop="onBlockDragStart(item.window, activeMobileDay, $event)"
                @resize-start="onResizeStart(item.window, activeMobileDay, $event)"
              />
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ── MOBILE: vista compacta 7 columnas ── -->
    <template v-else-if="showCompactWeek">
      <div ref="scrollContainerCompact" class="cal-scroll cal-scroll--compact">
        <!-- Compact header with nav arrows -->
        <div ref="panCompactHeaderRef" class="cal-header cal-header--compact"
          @touchstart.passive="onCalSwipeStart"
          @touchmove="onCalSwipeMove"
          @touchend.passive="onHeaderSwipeEnd"
        >
          <button class="cal-header__nav" @click="$emit('prev-week')">
            <i class="bx bx-chevron-left"></i>
          </button>
          <div
            v-for="(date, i) in weekDates"
            :key="date"
            class="cal-header__day cal-header__day--compact-cell"
            :class="{
              'cal-header__day--today': i === todayIndex,
              'cal-header__day--weekend': isWeekend(i),
            }"
          >
            <span class="cal-header__label">{{ DAY_LABELS[i] }}</span>
            <span class="cal-header__num cal-header__num--compact">{{ parseInt(date.split('-')[2]) }}</span>
          </div>
          <button class="cal-header__nav" @click="$emit('next-week')">
            <i class="bx bx-chevron-right"></i>
          </button>
        </div>

        <!-- Compact body -->
        <div ref="panCompactBodyRef" class="cal-body cal-body--compact">
          <!-- Gutter -->
          <div class="cal-gutter cal-gutter--compact">
            <div v-for="slot in SLOTS" :key="slot" class="cal-gutter__cell" :class="{ 'cal-gutter__cell--top': isHourTop(slot) }" :style="{ height: COMPACT_SLOT_H + 'px' }">
              <span v-if="isHourTop(slot)" class="cal-gutter__label cal-gutter__label--compact">{{ formatHourCompact(slot / 2) }}</span>
            </div>
          </div>

          <!-- 7 day columns -->
          <div
            v-for="(date, dayIdx) in weekDates"
            :key="date"
            class="cal-col cal-col--compact"
            :class="{
              'cal-col--today': dayIdx === todayIndex,
              'cal-col--weekend': isWeekend(dayIdx),
              'cal-col--dragging': dragging && isDayInSelection(dayIdx),
            }"
          >
            <div
              v-for="slot in SLOTS"
              :key="slot"
              class="cal-col__cell"
              :class="{
                'cal-col__cell--top': isHourTop(slot),
                'cal-col__cell--bottom': !isHourTop(slot),
              }"
              :style="{ height: COMPACT_SLOT_H + 'px' }"
              :data-day="dayIdx"
              :data-slot="slot"
              @touchstart.passive="onCellTouchstart(dayIdx, slot, $event); onCellLongPress(dayIdx, slot, $event)"
              @touchend="onCellTouchendTap(dayIdx, slot, $event); onLongPressEnd()"
              @touchmove="onLongPressMove()"
            ></div>

            <!-- Current time -->
            <div v-if="dayIdx === todayIndex" class="cal-now" :style="{ top: compactTimeTop + 'px' }">
              <span class="cal-now__dot cal-now__dot--compact"></span>
              <span class="cal-now__line"></span>
            </div>

            <!-- Eraser ghost -->
            <div
              v-if="erasing && dayIdx >= eraseDayMin && dayIdx <= eraseDayMax && compactEraseGhostStyle"
              class="cal-erase-ghost"
              :style="compactEraseGhostStyle"
            ></div>

            <!-- Drag/select preview -->
            <div
              v-if="dragging && isDayInSelection(dayIdx)"
              class="cal-drag"
              :style="compactSelectionStyle"
            >
              <span v-if="dayIdx === selDayMin" class="cal-drag__label cal-drag__label--compact">{{ selectionLabel }}</span>
            </div>

            <!-- Window blocks (compact) -->
            <template v-for="item in groupedByDay[dayIdx]" :key="item.type === 'group' ? item.id : `${item.window.id}-${dayIdx}`">
              <WindowGroupBlock
                v-if="item.type === 'group'"
                :group="item"
                :hour-height="COMPACT_HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :specialists="specialists"
                :applications="applications"
                :selectable="selectable"
                :compact="true"
                :multi-day-pos="_groupMultiDayPos(item)"
                :selected-ids="selectedWindowIds"
                :cut-ids="cutWindowIds"
                @click="(_, ev) => onGroupClick(item, ev)"
                @mousedown.stop="onGroupDragStart(item, dayIdx, $event)"
                @touchstart.stop="onGroupTouchstart(item, dayIdx, $event)"
                @touchend="onLongPressEnd()"
                @touchmove="onLongPressMove()"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :specialist-avatar="specAvatar(item.window)"
                :specialist-emoji="specEmoji(item.window)"
                :application-name="appName(item.window)"
                :app-color="appColor(item.window)"
                :hour-height="COMPACT_HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :selectable="selectable"
                :compact="true"
                :multi-day-pos="_multiDayPos(item.window)"
                :selected="selectedWindowIds.has((item.window._originalWindow || item.window).id)"
                :cut="cutWindowIds.has((item.window._originalWindow || item.window).id)"
                :inherited="!!(item.window.inheritedFromWindowId || item.window.inheritsOnReopen)"
                @click="(_, ev) => onBlockClick(item.window, ev)"
                @mousedown.stop="onBlockDragStart(item.window, dayIdx, $event)"
                @resize-start="onResizeStart(item.window, dayIdx, $event)"
                @touchstart.stop="onBlockTouchstart(item.window, dayIdx, $event)"
                @touchend="onLongPressEnd()"
                @touchmove="onLongPressMove()"
              />
            </template>

            <!-- Block drag ghost (compact) -->
            <div
              v-if="blockDragging && draggedTargetDay === dayIdx && compactBlockDragGhostStyle"
              class="cal-drag-ghost"
              :style="compactBlockDragGhostStyle"
            ></div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── MES: grid mensual ── -->
    <template v-else-if="viewMode === 'month'">
      <div ref="panMonthRef" class="mcal"
        @touchstart.passive="onCalSwipeStart"
        @touchmove="onCalSwipeMove"
        @touchend.passive="onCalSwipeEnd"
      >
        <div class="mcal__header">
          <div v-for="label in DAY_LABELS" :key="label" class="mcal__header-cell">{{ label }}</div>
        </div>
        <div class="mcal__body">
            <div v-for="(week, ri) in monthWeeks" :key="ri" class="mcal__row">
              <button
                v-for="cell in week"
                :key="cell.date"
                class="mcal__cell"
                :class="{
                  'mcal__cell--other': !cell.isCurrentMonth,
                  'mcal__cell--today': cell.isToday,
                  'mcal__cell--weekend': cell.isWeekend && !cell.isToday,
                  'mcal__cell--has-windows': cell.total > 0,
                }"
                :style="cell.total > 0 ? { '--cell-heat': cell.heat } : {}"
                @click="$emit('select-day', cell.date)"
              >
                <!-- Color strips at top -->
                <div v-if="cell.colors.length > 0" class="mcal__colors">
                  <span
                    v-for="(color, ci) in cell.colors"
                    :key="ci"
                    class="mcal__color-strip"
                    :style="{ background: color }"
                  ></span>
                </div>

                <!-- Day number -->
                <span class="mcal__day">{{ cell.dayNum }}</span>

                <!-- Coverage bar -->
                <div v-if="cell.total > 0" class="mcal__coverage">
                  <div class="mcal__coverage-fill" :style="{ width: Math.min(cell.coverage * 100, 100) + '%' }"></div>
                </div>

                <!-- Specialist avatars -->
                <div v-if="cell.specs.length > 0" class="mcal__specs">
                  <span
                    v-for="spec in cell.specs"
                    :key="spec.id"
                    class="mcal__spec"
                    :title="spec.name"
                  >{{ spec.initials }}</span>
                  <span v-if="cell.extraSpecs > 0" class="mcal__spec mcal__spec--extra">+{{ cell.extraSpecs }}</span>
                </div>

                <!-- Window counts -->
                <div v-if="cell.total > 0" class="mcal__counts">
                  <span v-if="cell.active > 0" class="mcal__count mcal__count--active">{{ cell.active }}</span>
                  <span v-if="cell.inactive > 0" class="mcal__count mcal__count--inactive">{{ cell.inactive }}</span>
                </div>
              </button>
            </div>
        </div>
      </div>
    </template>

    <!-- ── DESKTOP: grid de 7 días ── -->
    <template v-else>
      <div ref="scrollContainerWeek" class="cal-scroll">

        <!-- Sticky header -->
        <div class="cal-header" :style="gridColumns && { gridTemplateColumns: gridColumns }"
          @touchstart.passive="onCalSwipeStart"
          @touchend.passive="onHeaderSwipeEnd"
        >
          <div class="cal-header__gutter"></div>
          <div
            v-for="(date, i) in weekDates"
            :key="date"
            class="cal-header__day"
            :class="{
              'cal-header__day--today': i === todayIndex,
              'cal-header__day--weekend': isWeekend(i),
            }"
          >
            <span class="cal-header__label">{{ DAY_LABELS[i] }}</span>
            <span class="cal-header__num" :class="{ 'cal-header__num--today': i === todayIndex }">{{ parseInt(date.split('-')[2]) }}</span>
            <div
              v-if="i < weekDates.length - 1"
              class="cal-header__resize"
              @mousedown.stop.prevent="onColResizeStart(i, $event)"
              @dblclick.stop="onColResizeDblclick"
            ></div>
          </div>
        </div>

        <!-- Body -->
        <div class="cal-body" :style="gridColumns && { gridTemplateColumns: gridColumns }">
          <!-- Gutter -->
          <div class="cal-gutter">
            <div v-for="slot in SLOTS" :key="slot" class="cal-gutter__cell" :class="{ 'cal-gutter__cell--top': isHourTop(slot) }" :style="{ height: SLOT_H + 'px' }">
              <span v-if="isHourTop(slot)" class="cal-gutter__label">{{ formatHour(slot / 2) }}</span>
            </div>
          </div>

          <!-- Day columns -->
          <div
            v-for="(date, dayIdx) in weekDates"
            :key="date"
            class="cal-col"
            :class="{
              'cal-col--today': dayIdx === todayIndex,
              'cal-col--weekend': isWeekend(dayIdx),
              'cal-col--dragging': dragging && isDayInSelection(dayIdx),
            }"
          >
            <!-- Half-hour cells -->
            <div
              v-for="slot in SLOTS"
              :key="slot"
              class="cal-col__cell"
              :class="{
                'cal-col__cell--top': isHourTop(slot),
                'cal-col__cell--bottom': !isHourTop(slot),
              }"
              :style="{ height: SLOT_H + 'px' }"
              :data-day="dayIdx"
              :data-slot="slot"
              @mousedown.prevent="onCellMousedown(dayIdx, slot, $event)"
              @mouseenter="onCellMouseenter(dayIdx, slot)"
              @contextmenu.prevent="onCellContext(dayIdx, slot, $event)"
              @touchstart="onCellTouchstart(dayIdx, slot, $event); onCellLongPress(dayIdx, slot, $event)"
              @touchend="onLongPressEnd()"
              @touchmove.passive="onLongPressMove()"
            ></div>

            <!-- Current time -->
            <div
              v-if="dayIdx === todayIndex"
              class="cal-now"
              :style="{ top: currentTimeTop + 'px' }"
            >
              <span class="cal-now__dot"></span>
              <span class="cal-now__line"></span>
            </div>

            <!-- Drag preview -->
            <div
              v-if="dragging && isDayInSelection(dayIdx)"
              class="cal-drag"
              :style="selectionStyle"
            >
              <span v-if="dayIdx === selDayMin" class="cal-drag__label">{{ selectionLabel }}</span>
            </div>

            <!-- Horizontal expand highlight -->
            <div
              v-if="hExpandHighlight[dayIdx]"
              class="cal-hexpand-overlay"
              :style="{ top: hExpandHighlight[dayIdx].top + 'px', height: hExpandHighlight[dayIdx].height + 'px' }"
            ></div>

            <!-- Window blocks (singles and groups) -->
            <template v-for="item in groupedByDay[dayIdx]" :key="item.type === 'group' ? item.id : `${item.window.id}-${dayIdx}`">
              <WindowGroupBlock
                v-if="item.type === 'group'"
                :group="item"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :specialists="specialists"
                :applications="applications"
                :selectable="selectable"
                :multi-day-pos="_groupMultiDayPos(item)"
                :selected-ids="selectedWindowIds"
                :cut-ids="cutWindowIds"
                @click="(_, ev) => onGroupClick(item, ev)"
                @contextmenu.prevent="onGroupContext(item, $event)"
                @mousedown.stop="onGroupDragStart(item, dayIdx, $event)"
                @resize-start="onGroupResizeStart(item, dayIdx, $event)"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :specialist-avatar="specAvatar(item.window)"
                :specialist-emoji="specEmoji(item.window)"
                :application-name="appName(item.window)"
                :app-color="appColor(item.window)"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :selectable="selectable"
                :multi-day-pos="_multiDayPos(item.window)"
                :selected="selectedWindowIds.has((item.window._originalWindow || item.window).id)"
                :cut="cutWindowIds.has((item.window._originalWindow || item.window).id)"
                :inherited="!!(item.window.inheritedFromWindowId || item.window.inheritsOnReopen)"
                :inherit-label="inheritLabel(item.window)"
                :data-window-id="item.window.id"
                @click="(_, ev) => onBlockClick(item.window, ev)"
                @contextmenu.prevent="onWindowContext(item.window, $event)"
                @mousedown.stop="onBlockDragStart(item.window, dayIdx, $event)"
                @resize-start="onResizeStart(item.window, dayIdx, $event)"
              />
            </template>

            <!-- Block drag ghost -->
            <div
              v-if="blockDragging && draggedTargetDay === dayIdx && blockDragGhostStyle"
              class="cal-drag-ghost"
              :style="blockDragGhostStyle"
            ></div>

            <!-- Resize ghost -->
            <div
              v-if="resizing && resizeDayIdx === dayIdx && resizeGhostStyle"
              class="cal-resize-ghost"
              :style="resizeGhostStyle"
            ></div>

            <!-- Batch resize ghosts (other selected windows) -->
            <template v-if="batchResizeGhosts && batchResizeGhosts.has(dayIdx)">
              <div
                v-for="(gs, gi) in batchResizeGhosts.get(dayIdx)"
                :key="'brg-' + gi"
                class="cal-resize-ghost cal-resize-ghost--batch"
                :style="gs"
              ></div>
            </template>

            <!-- Eraser ghost -->
            <div
              v-if="erasing && dayIdx >= eraseDayMin && dayIdx <= eraseDayMax && eraseGhostStyle"
              class="cal-erase-ghost"
              :style="eraseGhostStyle"
            ></div>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
/* ========== Shell ========== */
.cal {
  background: var(--cal-shell);
  border-radius: var(--radius-lg);
  overflow: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* ========== Scroll ========== */
.cal-scroll {
  overflow: auto;
  flex: 1;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--cal-border) transparent;
}

.cal-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.cal-scroll::-webkit-scrollbar-track { background: transparent; }
.cal-scroll::-webkit-scrollbar-thumb { background: var(--cal-border); border-radius: 3px; }
.cal-scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--cal-border) 80%, var(--cal-text)); }

/* ========== Sticky header ========== */
.cal-header {
  display: grid;
  grid-template-columns: 3.5rem repeat(7, 1fr);
  background: var(--cal-header);
  position: sticky;
  top: 0;
  z-index: 20;
}

.cal-header__gutter {
  position: sticky;
  left: 0;
  z-index: 21;
  background: var(--cal-header);
}

.cal-header__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.55rem 0 0.45rem;
  border-right: 1px solid var(--cal-border);
  gap: 0.05rem;
  min-width: 0;
}

.cal-header__day:last-child { border-right: none; }

.cal-header__day--today { background: transparent; }
.cal-header__day--weekend:not(.cal-header__day--today) { background: transparent; }

.cal-header__label {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--cal-text-auto, var(--cal-text-dim));
  opacity: 0.65;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cal-header__day--today .cal-header__label {
  color: var(--primary-500);
}

.cal-header__num {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--cal-text-auto, var(--cal-text));
  line-height: 1.2;
  width: 1.9rem;
  height: 1.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.cal-header__num--today {
  background: color-mix(in srgb, var(--primary-500) 16%, transparent);
  color: var(--primary-500);
  font-weight: 700;
}

.cal-header__day--weekend:not(.cal-header__day--today) .cal-header__num {
  color: var(--cal-text-dim);
}

.cal-header__day--compact-cell.cal-header__day--today {
  background: transparent;
}

/* Column resize handle */
.cal-header__day {
  position: relative;
}

.cal-header__resize {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 25;
  transition: background 0.12s;
}

.cal-header__resize:hover {
  background: rgba(42, 199, 143, 0.35);
}

.cal-header__resize:active {
  background: rgba(42, 199, 143, 0.5);
}

/* ========== Body ========== */
.cal-body {
  display: grid;
  grid-template-columns: 3.5rem repeat(7, 1fr);
  padding-top: 15px;
  padding-bottom: 15px;
}

/* ========== Gutter ========== */
.cal-gutter {
  background: var(--cal-header);
  position: sticky;
  left: 0;
  z-index: 5;
}

.cal-gutter__cell {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 0.45rem;
}

.cal-gutter__label {
  font-size: 0.58rem;
  font-weight: 500;
  color: var(--cal-text-auto, var(--cal-text-dim));
  opacity: 0.7;
  line-height: 1;
  margin-top: -0.3em;
  white-space: nowrap;
}

/* First label (12 AM) — keep visible below header */
.cal-gutter__cell:first-child .cal-gutter__label {
  margin-top: 0.25em;
}

/* ========== Day columns ========== */
.cal-col {
  position: relative;
  border-right: 1px solid var(--cal-border);
  background: var(--cal-col);
}

.cal-col:last-child { border-right: none; }
.cal-col--today { background: transparent; }
.cal-col--weekend:not(.cal-col--today) { background: transparent; }

/* Half-hour cells */
.cal-col__cell {
  position: relative;
}

/* Top of hour — solid border */
.cal-col__cell--top {
  border-top: 1px solid var(--cal-grid);
}

/* Bottom of hour (half mark) — no separate line, matches mockup's single hairline-per-hour grid */
.cal-col__cell--bottom {
  border-top: none;
}

/* First cell: no double border with header */
.cal-col__cell:first-child {
  border-top: none;
}

.cal--selectable .cal-col__cell {
  cursor: cell;
}

.cal--selectable .cal-col__cell:hover {
  background: rgba(42, 199, 143, 0.06);
}

/* ========== Current time ========== */
.cal-now {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 12;
  pointer-events: none;
  display: flex;
  align-items: center;
}

.cal-now__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary-500);
  flex-shrink: 0;
  margin-left: -5px;
  box-shadow: 0 0 8px rgba(42, 199, 143, 0.6);
}

.cal-now__line {
  flex: 1;
  height: 2px;
  background: var(--primary-500);
  box-shadow: 0 0 4px rgba(42, 199, 143, 0.3);
}

/* ========== Drag preview ========== */
.cal-drag {
  position: absolute;
  left: 2%;
  width: 96%;
  background: rgba(42, 199, 143, 0.12);
  border: 2px solid rgba(42, 199, 143, 0.4);
  border-radius: 4px;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: drag-in 0.08s ease;
}

.cal-drag__label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--primary-500);
  background: var(--cal-col);
  padding: 0.12rem 0.55rem;
  border-radius: 3px;
  white-space: nowrap;
}

@keyframes drag-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Marquee 2D real del modo select (rectángulo en coords de cliente). */
.cal-marquee {
  position: fixed;
  z-index: 60;
  pointer-events: none;
  background: rgba(96, 165, 250, 0.14);
  border: 1.5px dashed rgba(96, 165, 250, 0.7);
  border-radius: 4px;
}

.cal-col--dragging {
  background: rgba(42, 199, 143, 0.04);
}

/* ========== Block drag ghost ========== */
.cal-drag-ghost {
  position: absolute;
  left: 3%;
  width: 92%;
  background: rgba(139, 143, 234, 0.15);
  border: 2px dashed rgba(139, 143, 234, 0.5);
  border-radius: 4px;
  z-index: 14;
  pointer-events: none;
}

/* ========== Resize ghost ========== */
.cal-resize-ghost {
  position: absolute;
  left: 3%;
  width: 92%;
  background: rgba(42, 199, 143, 0.12);
  border: 2px dashed rgba(42, 199, 143, 0.5);
  border-radius: 4px;
  z-index: 14;
  pointer-events: none;
}

.cal-resize-ghost--batch {
  background: rgba(42, 199, 143, 0.08);
  border-color: rgba(42, 199, 143, 0.35);
}

.cal--eraser .cal-col__cell {
  cursor: crosshair;
}

.cal--eraser :deep(.wb),
.cal--eraser :deep(.wgb) {
  pointer-events: none;
}

.cal--select-tool .cal-col__cell {
  cursor: default;
}

.cal-erase-ghost {
  position: absolute;
  left: 3%;
  width: 92%;
  background: rgba(239, 68, 68, 0.15);
  border: 2px dashed rgba(239, 68, 68, 0.5);
  border-radius: 4px;
  z-index: 14;
  pointer-events: none;
}

.cal-hexpand-overlay {
  position: absolute;
  left: 3%;
  width: 92%;
  background: rgba(42, 199, 143, 0.15);
  border: 2px dashed rgba(42, 199, 143, 0.5);
  border-radius: 4px;
  z-index: 14;
  pointer-events: none;
}


/* ========== Mobile nav de días ========== */
.cal-mobile-nav {
  display: flex;
  align-items: center;
  background: var(--cal-header);
  border-bottom: 1px solid var(--cal-border);
  padding: 0.4rem 0.25rem;
  gap: 0.25rem;
  flex-shrink: 0;
}

.cal-mobile-nav__arrow {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--cal-text-dim);
  font-size: 1.2rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.cal-mobile-nav__arrow:not(:disabled):hover {
  color: var(--cal-text);
  background: var(--cal-hover);
}

.cal-mobile-nav__arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.cal-mobile-nav__days {
  flex: 1;
  display: flex;
  justify-content: space-around;
  gap: 0.15rem;
}

.cal-mobile-nav__day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem 0.1rem;
  border-radius: var(--radius-sm);
  gap: 0.1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.cal-mobile-nav__day--active {
  background: rgba(42, 199, 143, 0.12);
}

.cal-mobile-nav__day--today .cal-mobile-nav__num {
  color: var(--primary-500);
  font-weight: 700;
}

.cal-mobile-nav__label {
  font-size: 0.5rem;
  font-weight: 600;
  color: var(--cal-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cal-mobile-nav__num {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--cal-text);
  line-height: 1;
}

/* ========== Grid mobile (1 columna) ========== */
.cal-body--mobile {
  grid-template-columns: 2.5rem 1fr;
}

/* ========== Responsive (desktop fallback) ========== */
@media (max-width: 768px) {
  .cal-header:not(.cal-header--compact),
  .cal-body:not(.cal-body--mobile):not(.cal-body--compact) {
    grid-template-columns: 2.5rem repeat(7, 1fr);
  }

  .cal-header__num {
    font-size: 1rem;
    width: 1.6rem;
    height: 1.6rem;
  }

  .cal-header__label { font-size: 0.52rem; }
  .cal-gutter__label { font-size: 0.5rem; }
  .cal-drag__label { font-size: 0.6rem; }
}

/* ========== Month grid ========== */
.mcal {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.mcal__header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--cal-header);
  border-bottom: 1px solid var(--cal-border);
}

.mcal__header-cell {
  padding: 0.5rem 0;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--cal-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mcal__body {
  display: grid;
  grid-template-rows: repeat(6, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

.mcal__row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  min-height: 0;
  border-bottom: 1px solid var(--cal-grid);
  overflow: hidden;
}

.mcal__row:last-child {
  border-bottom: none;
}

.mcal__cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 0;
  gap: 0;
  border-right: 1px solid var(--cal-grid);
  background: var(--cal-col);
  cursor: pointer;
  border-top: none;
  border-bottom: none;
  border-left: none;
  transition: background 0.15s, box-shadow 0.15s;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.mcal__cell:last-child {
  border-right: none;
}

.mcal__cell:hover {
  background: rgba(42, 199, 143, 0.08);
  box-shadow: inset 0 0 0 1px rgba(42, 199, 143, 0.25);
}

/* Heat-based subtle tint for cells with windows */
.mcal__cell--has-windows {
  background: color-mix(in srgb, rgba(42, 199, 143, 0.06) calc(var(--cell-heat, 0) * 100%), var(--cal-col));
}

.mcal__cell--other {
  background: var(--cal-col-other);
}

.mcal__cell--other .mcal__day {
  color: var(--cal-text-other);
}

.mcal__cell--other.mcal__cell--has-windows {
  background: color-mix(in srgb, rgba(42, 199, 143, 0.04) calc(var(--cell-heat, 0) * 100%), var(--cal-col-other));
}

.mcal__cell--weekend:not(.mcal__cell--today) {
  background: var(--cal-col-alt);
}

.mcal__cell--today {
  background: rgba(42, 199, 143, 0.1);
  box-shadow: inset 0 0 0 1.5px rgba(42, 199, 143, 0.35);
}

.mcal__cell--today .mcal__day {
  color: #1b1f2e;
  background: var(--primary-500);
  border-radius: 50%;
  width: 1.4rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

/* --- Color strips at top --- */
.mcal__colors {
  display: flex;
  height: 3px;
  width: 100%;
  flex-shrink: 0;
}

.mcal__color-strip {
  flex: 1;
  min-width: 0;
}

/* When no color strips, add top padding */
.mcal__cell:not(.mcal__cell--has-windows) {
  padding-top: 3px;
}

/* --- Day number --- */
.mcal__day {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--cal-text);
  line-height: 1;
  margin: 0.35rem 0 0.2rem;
  align-self: center;
}

/* --- Coverage bar --- */
.mcal__coverage {
  height: 3px;
  background: var(--cal-overlay);
  border-radius: 2px;
  margin: 0.15rem 0.4rem 0;
  overflow: hidden;
}

.mcal__coverage-fill {
  height: 100%;
  background: var(--primary-500);
  border-radius: 2px;
  opacity: 0.65;
  transition: width 0.3s ease;
}

/* --- Specialist avatars --- */
.mcal__specs {
  display: flex;
  justify-content: center;
  gap: 0.15rem;
  margin: 0.25rem 0.2rem 0;
  flex-wrap: wrap;
}

.mcal__spec {
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--cal-text);
  background: var(--cal-overlay);
  border-radius: 50%;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.mcal__spec--extra {
  background: rgba(42, 199, 143, 0.15);
  color: var(--primary-500);
  font-size: 0.45rem;
  border-radius: 3px;
  width: auto;
  padding: 0 0.2rem;
}

/* --- Window counts --- */
.mcal__counts {
  display: flex;
  gap: 0.2rem;
  align-items: center;
  justify-content: center;
  margin: auto 0 0.3rem;
  padding-top: 0.15rem;
}

.mcal__count {
  font-size: 0.52rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  line-height: 1;
}

.mcal__count--active {
  background: rgba(42, 199, 143, 0.18);
  color: var(--primary-500);
}

.mcal__count--inactive {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

@media (max-width: 768px) {
  .mcal__body {
    overflow-y: auto;
    grid-template-rows: repeat(6, minmax(4.5rem, auto));
  }

  .mcal__row {
    overflow: visible;
  }

  .mcal__cell {
    min-height: 0;
  }

  .mcal__day {
    font-size: 0.7rem;
  }

  .mcal__spec {
    width: 1rem;
    height: 1rem;
    font-size: 0.42rem;
  }

  .mcal__count {
    font-size: 0.45rem;
    padding: 0.08rem 0.2rem;
  }

  .mcal__header-cell {
    font-size: 0.55rem;
    padding: 0.35rem 0;
  }

  .mcal__coverage {
    margin: 0.1rem 0.25rem 0;
  }

  .mcal__specs {
    margin: 0.15rem 0.15rem 0;
  }
}

@media (max-width: 480px) {
  .cal-header:not(.cal-header--compact),
  .cal-body:not(.cal-body--mobile):not(.cal-body--compact) {
    grid-template-columns: 2rem repeat(7, 1fr);
  }

  .cal-header__num {
    font-size: 0.85rem;
    width: 1.4rem;
    height: 1.4rem;
  }

  .cal-header__label { font-size: 0.45rem; letter-spacing: -0.02em; }
  .cal-gutter__label { font-size: 0.42rem; }
}

/* ========== Compact week (mobile 7-col) ========== */
.cal-scroll--compact {
  position: relative;
}

.cal-header--compact {
  grid-template-columns: auto repeat(7, 1fr) auto;
  padding: 0;
}

.cal-header__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  padding: 0 0.15rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.12s;
}

.cal-header__nav:hover,
.cal-header__nav:active {
  color: var(--primary-500);
}

.cal-header__gutter--compact {
  width: 1.8rem;
}

.cal-header__day--compact-cell {
  padding: 0.3rem 0 0.25rem;
  gap: 0;
}

.cal-header__num--compact {
  font-size: 0.85rem;
}

.cal-body--compact {
  display: grid;
  grid-template-columns: 1.8rem repeat(7, 1fr);
  padding-top: 8px;
  padding-bottom: 8px;
}

.cal-gutter--compact {
  width: 1.8rem;
}

.cal-gutter--compact .cal-gutter__cell {
  padding-right: 0.15rem;
}

.cal-gutter__label--compact {
  font-size: 0.4rem;
  white-space: nowrap;
}

.cal-col--compact {
  min-width: 0;
}

.cal-now__dot--compact {
  width: 6px;
  height: 6px;
  margin-left: -3px;
}

.cal-drag__label--compact {
  font-size: 0.5rem;
  padding: 0.05rem 0.3rem;
}

/* ========== Day scroll wrapper ========== */
.cal-scroll--day-wrap {
  position: relative;
}

/* ========== Sticky date pill ========== */
.cal-day-pill {
  position: sticky;
  top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
  background: var(--cal-header);
  border: 1px solid var(--cal-border);
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--cal-text);
  backdrop-filter: blur(8px);
  z-index: 30;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, margin-top 0.2s ease;
  width: fit-content;
  margin: -2rem auto 0;
  text-transform: capitalize;
}

.cal-day-pill--visible {
  opacity: 1;
  margin-top: 0;
}

.cal-day-pill i {
  color: var(--primary-500);
  font-size: 0.9rem;
}

/* ========== Slide transitions ========== */
.slide-left-enter-active,
.slide-right-enter-active {
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

.slide-left-leave-active,
.slide-right-leave-active {
  transition: transform 0.12s ease-in, opacity 0.12s ease-in;
}

.slide-left-enter-from { transform: translateX(20px); opacity: 0; }
.slide-left-leave-to { transform: translateX(-20px); opacity: 0; }
.slide-right-enter-from { transform: translateX(-20px); opacity: 0; }
.slide-right-leave-to { transform: translateX(20px); opacity: 0; }
</style>

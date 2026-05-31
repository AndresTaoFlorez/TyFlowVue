<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import WindowBlock from '@/presentation/components/WindowBlock.vue'
import WindowGroupBlock from '@/presentation/components/WindowGroupBlock.vue'
import { useWindowGroups } from '@/presentation/composables/useWindowGroups'

const props = defineProps({
  windows: { type: Array, default: () => [] },
  weekDates: { type: Array, required: true },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
  viewMode: { type: String, default: 'week' }, // 'day' | 'week' | 'month'
  monthDates: { type: Array, default: () => [] }, // 42 ISO date strings for month grid
  currentMonth: { type: Number, default: 0 }, // 0-11 for month view
  activeTool: { type: String, default: 'default' }, // 'default' | 'eraser' | 'select'
  selectedWindowIds: { type: Object, default: () => new Set() }, // Set<string>
  cutWindowIds: { type: Object, default: () => new Set() }, // Set<string>
})

const emit = defineEmits(['select', 'range-selected', 'group-select', 'reschedule', 'group-reschedule', 'batch-reschedule', 'next-day', 'prev-day', 'resize', 'group-resize', 'select-day', 'context-window', 'context-group', 'context-cell', 'horizontal-expand', 'erase', 'selection-change'])

const SLOT_H = 30               // px per half-hour slot
const HOUR_H = SLOT_H * 2       // px per hour (used by WindowBlock)
const BASE_HOUR = 0
const SLOTS = Array.from({ length: 48 }, (_, i) => i)  // 0..47 → 00:00, 00:30, …, 23:30
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const scrollContainer = ref(null)

// ---- Single day view (mobile or day viewMode) ----
const showSingleDay = computed(() => {
  if (props.viewMode === 'month') return false
  return props.isMobile || props.viewMode === 'day'
})
const activeMobileDay = ref(0)

let swipeStartX = 0
let swipeStartY = 0

const onCalSwipeStart = (e) => {
  swipeStartX = e.touches[0].clientX
  swipeStartY = e.touches[0].clientY
}

const onCalSwipeEnd = (e) => {
  const dx = e.changedTouches[0].clientX - swipeStartX
  const dy = e.changedTouches[0].clientY - swipeStartY
  if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 40) return
  // In day mode (1 date from parent), emit to parent for navigation
  if (props.viewMode === 'day') {
    emit(dx < 0 ? 'next-day' : 'prev-day')
    return
  }
  // In mobile week mode, navigate within the 7 days
  if (dx < 0 && activeMobileDay.value < props.weekDates.length - 1) activeMobileDay.value++
  if (dx > 0 && activeMobileDay.value > 0) activeMobileDay.value--
}

// ---- Today & current time ----
const now = ref(new Date())
let timeInterval = null

const todayStr = computed(() => {
  const d = now.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
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
  return (d.getHours() + d.getMinutes() / 60) * HOUR_H
})

onMounted(() => {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = 7 * HOUR_H
    }
  })
  timeInterval = setInterval(() => { now.value = new Date() }, 30000)
  if (showSingleDay.value) {
    activeMobileDay.value = props.weekDates.length === 1 ? 0 : (todayIndex.value >= 0 ? todayIndex.value : 0)
  }
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
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
    top: selSlotMin.value * SLOT_H + 'px',
    height: (selSlotMax.value - selSlotMin.value) * SLOT_H + 'px',
  }
})

const selectionLabel = computed(() => {
  if (!dragging.value) return ''
  const startH = Math.floor(selSlotMin.value / 2)
  const startM = (selSlotMin.value % 2) * 30
  const endH = Math.floor(selSlotMax.value / 2)
  const endM = (selSlotMax.value % 2) * 30
  const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return `${fmt(startH, startM)} – ${fmt(endH, endM)}`
})

const onCellMousedown = (dayIdx, slot, e) => {
  if (!props.selectable) return
  if (e && e.button === 2) return // ignore right-click
  if (props.activeTool === 'eraser') {
    onEraserStart(dayIdx, slot)
    return
  }
  if (props.activeTool === 'select') {
    // Start rectangle selection drag
    dragging.value = true
    dragStartDay.value = dayIdx
    dragStartSlot.value = slot
    dragEndDay.value = dayIdx
    dragEndSlot.value = slot
    return
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

const onMouseup = () => {
  if (!dragging.value) return
  const startH = Math.floor(selSlotMin.value / 2)
  const startM = (selSlotMin.value % 2) * 30
  const endH = Math.floor(selSlotMax.value / 2)
  const endM = (selSlotMax.value % 2) * 30

  if (props.activeTool === 'select') {
    // Rectangle selection: find all windows within the rect
    const rectStartHour = startH + startM / 60
    const rectEndHour = endH + endM / 60
    const ids = new Set(props.selectedWindowIds)
    for (const w of props.windows) {
      const dayIdx = props.weekDates.indexOf(w.scheduledDate)
      if (dayIdx < selDayMin.value || dayIdx > selDayMax.value) continue
      if (w.endHour <= rectStartHour || w.startHour >= rectEndHour) continue
      ids.add(w.id)
    }
    emit('selection-change', ids)
    dragging.value = false
    dragStartDay.value = -1
    dragEndDay.value = -1
    return
  }

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

// Mobile double-tap: first tap preselects slot, second tap triggers creation
const mobileTapSlot = ref(null) // { dayIdx, slot }
let mobileTapTimer = null

const onCellTap = (dayIdx, slot) => {
  if (!props.selectable || !props.isMobile) return

  // If same slot tapped again → emit range-selected to open creation modal
  if (mobileTapSlot.value && mobileTapSlot.value.dayIdx === dayIdx && mobileTapSlot.value.slot === slot) {
    clearTimeout(mobileTapTimer)
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
    mobileTapSlot.value = null
    return
  }

  // First tap — preselect
  mobileTapSlot.value = { dayIdx, slot }
  // Auto-clear preselection after 2 seconds
  clearTimeout(mobileTapTimer)
  mobileTapTimer = setTimeout(() => { mobileTapSlot.value = null }, 2000)
}

const mobilePreselectionStyle = computed(() => {
  if (!mobileTapSlot.value) return null
  return {
    top: mobileTapSlot.value.slot * SLOT_H + 'px',
    height: SLOT_H * 2 + 'px', // 1-hour block preview
  }
})

const onCellTouchstart = (dayIdx, slot, e) => {
  if (!props.selectable) return
  if (props.isMobile) {
    // On mobile, use tap-based creation (handled in onCellTouchendTap)
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
  onCellTap(dayIdx, slot)
}

const onTouchmove = (e) => {
  // If the long-press hasn't activated yet, user is scrolling — cancel and don't interfere
  if (!touchActive.value && !blockDragging.value && !resizing.value && !hExpanding.value) {
    if (touchTimer) {
      clearTimeout(touchTimer)
      touchTimer = null
    }
    return // Don't call preventDefault — let native scroll work
  }
  if (!dragging.value && !blockDragging.value && !resizing.value && !hExpanding.value) return
  // Only prevent scroll when drag is confirmed
  e.preventDefault()
  if (hExpanding.value) { onHExpandMove(e); return }
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
  touchActive.value = false
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

const onBlockDragStart = (w, dayIdx, e) => {
  if (!props.selectable) return
  if (props.activeTool === 'eraser') return
  if (props.activeTool === 'select') {
    const id = (w._originalWindow || w).id
    // Only allow drag if the window is already selected
    if (!props.selectedWindowIds.has(id)) return
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
  batchDragging.value = false
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
  e.stopPropagation()
  blockDragging.value = true
  blockDragMoved = false
  draggedGroup.value = group
  draggedWindow.value = { startHour: group.startHour, endHour: group.endHour }
  draggedOriginDay.value = dayIdx
  draggedTargetDay.value = dayIdx
  draggedTargetSlot.value = Math.round(group.startHour * 2)

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
    top: draggedTargetSlot.value * SLOT_H + 'px',
    height: duration * HOUR_H + 'px',
  }
})

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

  const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

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
      startTime: fmt(startH, startM),
      endTime: fmt(endH, endM),
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

const resizeGhostStyle = computed(() => {
  if (!resizing.value) return null
  const source = resizeWindow.value || resizeGroup.value
  if (!source) return null
  const startHour = source.startHour ?? source.startHour
  const endHour = source.endHour ?? source.endHour
  let topSlot, bottomSlot
  if (resizeDirection.value === 'top') {
    topSlot = Math.min(resizeSlot.value, Math.round(endHour * 2) - 1)
    bottomSlot = Math.round(endHour * 2)
  } else {
    topSlot = Math.round(startHour * 2)
    bottomSlot = Math.max(resizeSlot.value + 1, topSlot + 1)
  }
  return {
    top: topSlot * SLOT_H + 'px',
    height: (bottomSlot - topSlot) * SLOT_H + 'px',
  }
})

const onResizeEnd = () => {
  if (!resizing.value) return
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

  const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

  if (group) {
    emit('group-resize', {
      group,
      startTime: fmt(sH, sM),
      endTime: fmt(eH, eM),
    })
  } else {
    const original = w._originalWindow || w
    const payload = { window: original }
    if (dir === 'top') {
      payload.startTime = fmt(sH, sM)
    } else {
      payload.endTime = fmt(eH, eM)
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
  const top = (w.startHour - BASE_HOUR) * HOUR_H
  const height = (w.endHour - w.startHour) * HOUR_H
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
  const fmt = (slot) => {
    const h = Math.floor(slot / 2)
    const m = (slot % 2) * 30
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const dates = []
  for (let d = eraseDayMin.value; d <= eraseDayMax.value; d++) {
    dates.push(props.weekDates[d])
  }
  emit('erase', {
    dates,
    startTime: fmt(minSlot),
    endTime: fmt(maxSlot),
  })
}

const eraseGhostStyle = computed(() => {
  if (!erasing.value) return null
  const minSlot = Math.min(eraseStartSlot.value, eraseEndSlot.value)
  const maxSlot = Math.max(eraseStartSlot.value, eraseEndSlot.value) + 1
  return {
    top: minSlot * SLOT_H + 'px',
    height: (maxSlot - minSlot) * SLOT_H + 'px',
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
  } else if (e.ctrlKey || e.metaKey) {
    // Toggle individual
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
  } else {
    // Single select
    ids.clear()
    ids.add(id)
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
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', onColResizeEnd)
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
        const isFirst = d === startIdx
        const isLast = d === endIdx
        byDay[d].push({
          ...w._toRaw(),
          id: w.id,
          _multiDayProxy: true,
          _originalWindow: w,
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
          openingCount: w.openingCount,
          currentCount: w.currentCount,
          closingCount: w.closingCount,
          inheritedFromWindowId: w.inheritedFromWindowId,
        })
      }
    }
  }
  return byDay
})

const groupedByDay = useWindowGroups(windowsByDay)

// Suppress click after drag — click fires after mouseup on the same element
let hExpandJustEnded = false
const onBlockClick = (w, e) => {
  if (blockDragMoved) { blockDragMoved = false; return }
  if (hExpandJustEnded) { hExpandJustEnded = false; return }
  if (props.activeTool === 'select') {
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
  const hour = Math.floor(slot / 2)
  const min = (slot % 2) * 30
  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  emit('context-cell', { date, time, x: e.clientX, y: e.clientY })
}

// ---- Long-press for mobile context menu ----
let longPressTimer = null
let longPressFired = false

const onLongPressStart = (emitFn, e) => {
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
    const hour = Math.floor(slot / 2)
    const min = (slot % 2) * 30
    const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    emit('context-cell', { date, time, x, y })
  }, e)
}

const onWindowLongPress = (w, e) => {
  onLongPressStart((x, y) => {
    emit('context-window', { window: w._originalWindow || w, x, y })
  }, e)
}

const onGroupLongPress = (group, e) => {
  onLongPressStart((x, y) => {
    emit('context-group', { group, x, y })
  }, e)
}

const onGroupClick = (group) => {
  if (blockDragMoved) return
  emit('group-select', group)
}

const findSpecialist = (id) => props.specialists.find(u => u.specialistId === id)
const findApp = (id) => props.applications.find(a => a.id === id)
const specName = (w) => findSpecialist(w.specialistId)?.fullName || w.specialistId
const appName = (w) => findApp(w.applicationId)?.name || w.applicationId
const appColor = (w) => { const a = findApp(w.applicationId); return a?.color || a?.theme?.color || null }

const formatHour = (h) => {
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display} ${suffix}`
}

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
</script>

<template>
  <div
    class="cal"
    :class="{ 'cal--selectable': selectable, 'cal--eraser': activeTool === 'eraser', 'cal--select-tool': activeTool === 'select' }"
    @mouseleave="cancelDrag"
    @mouseup="onMouseup(); onBlockDragEnd(); onResizeEnd(); onHExpandEnd(); onEraserEnd()"
    @mousemove="onBlockDragMove"
    @touchmove="onTouchmove"
    @touchend="onTouchend"
    @touchstart.passive="showSingleDay && onCalSwipeStart($event)"
  >

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
      <div ref="scrollContainer" class="cal-scroll"
           @touchend.passive="showSingleDay && onCalSwipeEnd($event)">
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
                'cal-col__cell--preselected': mobileTapSlot && mobileTapSlot.dayIdx === activeMobileDay && mobileTapSlot.slot === slot,
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

            <!-- Mobile preselection indicator -->
            <div
              v-if="mobileTapSlot && mobileTapSlot.dayIdx === activeMobileDay"
              class="cal-preselect"
              :style="mobilePreselectionStyle"
            >
              <span class="cal-preselect__label">Toca de nuevo para crear</span>
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
                :col="0"
                :total-cols="1"
                :specialists="specialists"
                :applications="applications"
                :selectable="selectable"
                @click="onGroupClick(item)"
                @contextmenu.prevent="onGroupContext(item, $event)"
                @touchstart.passive="onGroupLongPress(item, $event)"
                @touchend="onLongPressEnd()"
                @touchmove.passive="onLongPressMove()"
                @mousedown.stop="onGroupDragStart(item, activeMobileDay, $event)"
                @resize-start="onGroupResizeStart(item, activeMobileDay, $event)"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :application-name="appName(item.window)"
                :app-color="appColor(item.window)"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="0"
                :total-cols="1"
                :selectable="selectable"
                :selected="selectedWindowIds.has((item.window._originalWindow || item.window).id)"
                :cut="cutWindowIds.has((item.window._originalWindow || item.window).id)"
                :inherited="!!(item.window.inheritedFromWindowId || item.window.inheritsOnReopen)"
                @click="onBlockClick(item.window, $event)"
                @contextmenu.prevent="onWindowContext(item.window, $event)"
                @touchstart.passive="onWindowLongPress(item.window, $event)"
                @touchend="onLongPressEnd()"
                @touchmove.passive="onLongPressMove()"
                @mousedown.stop="onBlockDragStart(item.window, activeMobileDay, $event)"
                @resize-start="onResizeStart(item.window, activeMobileDay, $event)"
              />
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ── MES: grid mensual ── -->
    <template v-else-if="viewMode === 'month'">
      <div class="mcal">
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
      <div ref="scrollContainer" class="cal-scroll">

        <!-- Sticky header -->
        <div class="cal-header" :style="gridColumns && { gridTemplateColumns: gridColumns }">
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
            <span class="cal-header__num">{{ parseInt(date.split('-')[2]) }}</span>
            <span class="cal-header__label">{{ DAY_LABELS[i] }}</span>
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
                @click="onGroupClick(item)"
                @contextmenu.prevent="onGroupContext(item, $event)"
                @mousedown.stop="onGroupDragStart(item, dayIdx, $event)"
                @resize-start="onGroupResizeStart(item, dayIdx, $event)"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :application-name="appName(item.window)"
                :app-color="appColor(item.window)"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :selectable="selectable"
                :selected="selectedWindowIds.has((item.window._originalWindow || item.window).id)"
                :cut="cutWindowIds.has((item.window._originalWindow || item.window).id)"
                :inherited="!!(item.window.inheritedFromWindowId || item.window.inheritsOnReopen)"
                :data-window-id="item.window.id"
                @click="onBlockClick(item.window, $event)"
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
  background: #292d3e;
  border: 1px solid #3b3f54;
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
  scrollbar-color: #3b3f54 transparent;
}

.cal-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.cal-scroll::-webkit-scrollbar-track { background: transparent; }
.cal-scroll::-webkit-scrollbar-thumb { background: #3b3f54; border-radius: 3px; }
.cal-scroll::-webkit-scrollbar-thumb:hover { background: #4f5470; }

/* ========== Sticky header ========== */
.cal-header {
  display: grid;
  grid-template-columns: 3.5rem repeat(7, 1fr);
  border-bottom: 1px solid #3b3f54;
  background: #252839;
  position: sticky;
  top: 0;
  z-index: 20;
}

.cal-header__gutter {
  border-right: 1px solid #3b3f54;
  position: sticky;
  left: 0;
  z-index: 21;
  background: #252839;
}

.cal-header__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.55rem 0 0.45rem;
  border-right: 1px solid #3b3f54;
  gap: 0.05rem;
  min-width: 0;
}

.cal-header__day:last-child { border-right: none; }

.cal-header__day--today { background: rgba(42, 199, 143, 0.06); }
.cal-header__day--weekend:not(.cal-header__day--today) { background: #242736; }

.cal-header__num {
  font-size: 1.3rem;
  font-weight: 700;
  color: #c8cdd8;
  line-height: 1.2;
}

.cal-header__day--today .cal-header__num {
  color: var(--primary-500);
}

.cal-header__day--weekend:not(.cal-header__day--today) .cal-header__num {
  color: #6c7293;
}

.cal-header__label {
  font-size: 0.62rem;
  font-weight: 600;
  color: #6c7293;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cal-header__day--today .cal-header__label {
  color: var(--primary-500);
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
  border-right: 1px solid #3b3f54;
  background: #252839;
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
  color: #6c7293;
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
  border-right: 1px solid #3b3f54;
  background: #292d3e;
}

.cal-col:last-child { border-right: none; }
.cal-col--today { background: rgba(42, 199, 143, 0.03); }
.cal-col--weekend:not(.cal-col--today) { background: #262938; }

/* Half-hour cells */
.cal-col__cell {
  position: relative;
}

/* Top of hour — solid border */
.cal-col__cell--top {
  border-top: 1px solid #33374a;
}

/* Bottom of hour (half mark) — dashed subtle border */
.cal-col__cell--bottom {
  border-top: 1px dashed #2e3244;
}

/* First cell: no double border with header */
.cal-col__cell:first-child {
  border-top: none;
}

.cal--selectable .cal-col__cell {
  cursor: crosshair;
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
  box-shadow: 0 0 6px rgba(42, 199, 143, 0.5);
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
  background: rgba(37, 40, 57, 0.92);
  padding: 0.12rem 0.55rem;
  border-radius: 3px;
  white-space: nowrap;
}

@keyframes drag-in {
  from { opacity: 0; }
  to { opacity: 1; }
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

/* ========== Mobile preselection ========== */
.cal-col__cell--preselected {
  background: rgba(42, 199, 143, 0.1) !important;
}

.cal-preselect {
  position: absolute;
  left: 2%;
  width: 96%;
  background: rgba(42, 199, 143, 0.08);
  border: 2px dashed rgba(42, 199, 143, 0.35);
  border-radius: 4px;
  z-index: 13;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: drag-in 0.15s ease;
}

.cal-preselect__label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--primary-500);
  background: rgba(37, 40, 57, 0.9);
  padding: 0.1rem 0.5rem;
  border-radius: 3px;
  white-space: nowrap;
}

/* ========== Mobile nav de días ========== */
.cal-mobile-nav {
  display: flex;
  align-items: center;
  background: #252839;
  border-bottom: 1px solid #3b3f54;
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
  color: #6c7293;
  font-size: 1.2rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.cal-mobile-nav__arrow:not(:disabled):hover {
  color: #c8cdd8;
  background: rgba(255,255,255,0.05);
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
  color: #6c7293;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cal-mobile-nav__num {
  font-size: 0.9rem;
  font-weight: 600;
  color: #c8cdd8;
  line-height: 1;
}

/* ========== Grid mobile (1 columna) ========== */
.cal-body--mobile {
  grid-template-columns: 2.5rem 1fr;
}

/* ========== Responsive (desktop fallback) ========== */
@media (max-width: 768px) {
  .cal-header,
  .cal-body:not(.cal-body--mobile) {
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
  background: #252839;
  border-bottom: 1px solid #3b3f54;
}

.mcal__header-cell {
  padding: 0.5rem 0;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: #6c7293;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mcal__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.mcal__row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  flex: 1;
  min-height: 0;
  border-bottom: 1px solid #33374a;
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
  border-right: 1px solid #33374a;
  background: #292d3e;
  cursor: pointer;
  border-top: none;
  border-bottom: none;
  border-left: none;
  transition: background 0.15s, box-shadow 0.15s;
  min-height: 5.5rem;
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
  background: color-mix(in srgb, rgba(42, 199, 143, 0.06) calc(var(--cell-heat, 0) * 100%), #292d3e);
}

.mcal__cell--other {
  background: #242736;
}

.mcal__cell--other .mcal__day {
  color: #4a4e66;
}

.mcal__cell--other.mcal__cell--has-windows {
  background: color-mix(in srgb, rgba(42, 199, 143, 0.04) calc(var(--cell-heat, 0) * 100%), #242736);
}

.mcal__cell--weekend:not(.mcal__cell--today) {
  background: #262938;
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
  color: #c8cdd8;
  line-height: 1;
  margin: 0.35rem 0 0.2rem;
  align-self: center;
}

/* --- Coverage bar --- */
.mcal__coverage {
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
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
  color: #c8cdd8;
  background: rgba(255, 255, 255, 0.08);
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
  .mcal__cell {
    min-height: 4rem;
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
  .cal-header,
  .cal-body:not(.cal-body--mobile) {
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
</style>

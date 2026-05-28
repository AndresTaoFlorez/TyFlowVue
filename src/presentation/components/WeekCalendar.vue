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
  viewMode: { type: String, default: 'week' }, // 'day' | 'week'
})

const emit = defineEmits(['select', 'range-selected', 'group-select', 'reschedule', 'group-reschedule'])

const SLOT_H = 30               // px per half-hour slot
const HOUR_H = SLOT_H * 2       // px per hour (used by WindowBlock)
const BASE_HOUR = 0
const SLOTS = Array.from({ length: 48 }, (_, i) => i)  // 0..47 → 00:00, 00:30, …, 23:30
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const scrollContainer = ref(null)

// ---- Single day view (mobile or day viewMode) ----
const showSingleDay = computed(() => props.isMobile || props.viewMode === 'day')
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
  if (dx < 0 && activeMobileDay.value < 6) activeMobileDay.value++
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
    activeMobileDay.value = todayIndex.value >= 0 ? todayIndex.value : 0
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

const onCellMousedown = (dayIdx, slot) => {
  if (!props.selectable) return
  dragging.value = true
  dragStartDay.value = dayIdx
  dragStartSlot.value = slot
  dragEndDay.value = dayIdx
  dragEndSlot.value = slot
}

const onCellMouseenter = (dayIdx, slot) => {
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
  // Cancel long-press if finger moves (user is scrolling)
  if (touchTimer && !touchActive.value) {
    clearTimeout(touchTimer)
    touchTimer = null
    return
  }
  if (!dragging.value && !blockDragging.value) return
  e.preventDefault()
  const touch = e.touches[0]
  const elements = document.elementsFromPoint(touch.clientX, touch.clientY)
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
}

// ---- Block drag (reschedule) ----
const blockDragging = ref(false)
const draggedWindow = ref(null)
const draggedGroup = ref(null)
const draggedOriginDay = ref(-1)
const draggedTargetDay = ref(-1)
const draggedTargetSlot = ref(0)

const onBlockDragStart = (w, dayIdx, e) => {
  if (!props.selectable) return
  e.stopPropagation()
  blockDragging.value = true
  draggedWindow.value = w
  draggedGroup.value = null
  draggedOriginDay.value = dayIdx
  draggedTargetDay.value = dayIdx
  draggedTargetSlot.value = Math.round(w.startHour * 2)
}

const onGroupDragStart = (group, dayIdx, e) => {
  if (!props.selectable) return
  e.stopPropagation()
  blockDragging.value = true
  draggedGroup.value = group
  draggedWindow.value = { startHour: group.startHour, endHour: group.endHour }
  draggedOriginDay.value = dayIdx
  draggedTargetDay.value = dayIdx
  draggedTargetSlot.value = Math.round(group.startHour * 2)
}

const onBlockDragMove = (e) => {
  if (!blockDragging.value) return
  const x = e.clientX || e.touches?.[0]?.clientX
  const y = e.clientY || e.touches?.[0]?.clientY
  // Use elementsFromPoint to look through all layers (blocks sit on top of cells)
  const elements = document.elementsFromPoint(x, y)
  const cell = elements.find(el => el.dataset.slot !== undefined)
  if (cell) {
    draggedTargetDay.value = parseInt(cell.dataset.day)
    draggedTargetSlot.value = parseInt(cell.dataset.slot)
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

  blockDragging.value = false
  draggedWindow.value = null
  draggedGroup.value = null

  if (!w) return

  const targetDate = props.weekDates[targetDay]
  const startH = Math.floor(targetSlot / 2)
  const startM = (targetSlot % 2) * 30
  const duration = w.endHour - w.startHour
  const endDecimal = startH + startM / 60 + duration
  const endH = Math.floor(endDecimal)
  const endM = Math.round((endDecimal % 1) * 60)

  const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  if (group) {
    // Reschedule all windows in the group by the same time delta
    const deltaHours = (startH + startM / 60) - group.startHour
    const deltaDate = targetDate !== props.weekDates[draggedOriginDay.value] ? targetDate : null
    emit('group-reschedule', {
      group,
      targetDate,
      deltaHours,
    })
  } else {
    emit('reschedule', {
      window: w,
      targetDate,
      startTime: fmt(startH, startM),
      endTime: fmt(endH, endM),
    })
  }
}

// ---- Windows by day ----
const windowsByDay = computed(() => {
  const byDay = Array.from({ length: 7 }, () => [])
  for (const w of props.windows) {
    if (!w.scheduledDate) continue
    const dayIdx = props.weekDates.indexOf(w.scheduledDate)
    if (dayIdx === -1) continue
    const copy = { ...w, startHour: w.startHour, endHour: w.endHour, isSessionOpen: w.isSessionOpen, timeRange: w.timeRange, _dayIndex: dayIdx }
    byDay[dayIdx].push(copy)
  }
  for (let d = 0; d < 7; d++) {
    const sorted = byDay[d].sort((a, b) => a.startHour - b.startHour)
    const placed = []
    for (const block of sorted) {
      let col = 0
      for (const p of placed) {
        if (block.startHour < p.endHour && block.endHour > p.startHour && p._col === col) col++
      }
      block._col = col
      placed.push(block)
    }
    const maxCols = placed.length > 0 ? Math.max(...placed.map(p => p._col)) + 1 : 1
    for (const block of byDay[d]) block._totalCols = maxCols
  }
  return byDay
})

const groupedByDay = useWindowGroups(windowsByDay)

const findSpecialist = (id) => props.specialists.find(u => u.specialistId === id)
const findApp = (id) => props.applications.find(a => a.id === id)
const specName = (w) => findSpecialist(w.specialistId)?.fullName || w.specialistId
const appName = (w) => findApp(w.applicationId)?.name || w.applicationId

const formatHour = (h) => {
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display} ${suffix}`
}

const isWeekend = (dayIdx) => dayIdx >= 5
const isHourTop = (slot) => slot % 2 === 0
</script>

<template>
  <div
    class="cal"
    :class="{ 'cal--selectable': selectable }"
    @mouseleave="cancelDrag"
    @mouseup="onMouseup(); onBlockDragEnd()"
    @mousemove="onBlockDragMove"
    @touchmove="onTouchmove"
    @touchend="onTouchend"
    @touchstart.passive="showSingleDay && onCalSwipeStart($event)"
  >

    <!-- ── MOBILE: vista de 1 día ── -->
    <template v-if="showSingleDay">
      <!-- Nav de días -->
      <div class="cal-mobile-nav">
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
                :disabled="activeMobileDay === 6"
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
              @mousedown.prevent="onCellMousedown(activeMobileDay, slot)"
              @mouseenter="onCellMouseenter(activeMobileDay, slot)"
              @touchstart.passive="onCellTouchstart(activeMobileDay, slot, $event)"
              @touchend="onCellTouchendTap(activeMobileDay, slot, $event)"
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
                @click="$emit('group-select', item)"
                @mousedown.stop="!isMobile && onGroupDragStart(item, activeMobileDay, $event)"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :application-name="appName(item.window)"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="0"
                :total-cols="1"
                @click="$emit('select', item.window)"
                @mousedown.stop="!isMobile && onBlockDragStart(item.window, activeMobileDay, $event)"
              />
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ── DESKTOP: grid de 7 días ── -->
    <template v-else>
      <div ref="scrollContainer" class="cal-scroll">

        <!-- Sticky header -->
        <div class="cal-header">
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
          </div>
        </div>

        <!-- Body -->
        <div class="cal-body">
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
              @mousedown.prevent="onCellMousedown(dayIdx, slot)"
              @mouseenter="onCellMouseenter(dayIdx, slot)"
              @touchstart="onCellTouchstart(dayIdx, slot, $event)"
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
                @click="$emit('group-select', item)"
                @mousedown.stop="onGroupDragStart(item, dayIdx, $event)"
              />
              <WindowBlock
                v-else
                :window="item.window"
                :specialist-name="specName(item.window)"
                :application-name="appName(item.window)"
                :hour-height="HOUR_H"
                :base-hour="BASE_HOUR"
                :col="item._col"
                :total-cols="item._totalCols"
                :data-window-id="item.window.id"
                @click="$emit('select', item.window)"
                @mousedown.stop="onBlockDragStart(item.window, dayIdx, $event)"
              />
            </template>

            <!-- Block drag ghost -->
            <div
              v-if="blockDragging && draggedTargetDay === dayIdx && blockDragGhostStyle"
              class="cal-drag-ghost"
              :style="blockDragGhostStyle"
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

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import WindowBlock from '@/presentation/components/WindowBlock.vue'

const props = defineProps({
  windows: { type: Array, default: () => [] },
  weekDates: { type: Array, required: true },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'range-selected'])

const HOUR_H = 52
const BASE_HOUR = 0
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const scrollContainer = ref(null)

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const todayIndex = computed(() => props.weekDates.indexOf(todayStr.value))

// Scroll a hora laboral al montar
onMounted(() => {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = 7 * HOUR_H // 7:00
    }
  })
})

// ---- Drag selection state ----
const dragging = ref(false)
const dragDay = ref(-1)
const dragStartHour = ref(0)
const dragEndHour = ref(0)

const selMinHour = computed(() => Math.min(dragStartHour.value, dragEndHour.value))
const selMaxHour = computed(() => Math.max(dragStartHour.value, dragEndHour.value) + 1)

const selectionStyle = computed(() => {
  if (!dragging.value || dragDay.value < 0) return null
  return {
    top: (selMinHour.value - BASE_HOUR) * HOUR_H + 'px',
    height: (selMaxHour.value - selMinHour.value) * HOUR_H + 'px',
  }
})

const selectionLabel = computed(() => {
  if (!dragging.value) return ''
  return `${String(selMinHour.value).padStart(2, '0')}:00 – ${String(selMaxHour.value).padStart(2, '0')}:00`
})

const onCellMousedown = (dayIdx, hourIdx) => {
  if (!props.selectable) return
  dragging.value = true
  dragDay.value = dayIdx
  dragStartHour.value = BASE_HOUR + hourIdx
  dragEndHour.value = BASE_HOUR + hourIdx
}

const onCellMouseenter = (dayIdx, hourIdx) => {
  if (!dragging.value || dayIdx !== dragDay.value) return
  dragEndHour.value = BASE_HOUR + hourIdx
}

const onMouseup = () => {
  if (!dragging.value) return
  emit('range-selected', {
    dayIndex: dragDay.value,
    date: props.weekDates[dragDay.value],
    startHour: selMinHour.value,
    endHour: selMaxHour.value,
  })
  dragging.value = false
  dragDay.value = -1
}

const cancelDrag = () => {
  dragging.value = false
  dragDay.value = -1
}

// ---- Touch support ----
const onCellTouchstart = (dayIdx, hourIdx, e) => {
  if (!props.selectable) return
  e.preventDefault()
  dragging.value = true
  dragDay.value = dayIdx
  dragStartHour.value = BASE_HOUR + hourIdx
  dragEndHour.value = BASE_HOUR + hourIdx
}

const onTouchmove = (e) => {
  if (!dragging.value) return
  const touch = e.touches[0]
  const el = document.elementFromPoint(touch.clientX, touch.clientY)
  if (el && el.dataset.hour !== undefined && parseInt(el.dataset.day) === dragDay.value) {
    dragEndHour.value = BASE_HOUR + parseInt(el.dataset.hour)
  }
}

const onTouchend = () => {
  onMouseup()
}

// ---- Agrupar ventanas por dia ----
const windowsByDay = computed(() => {
  const byDay = Array.from({ length: 7 }, () => [])
  for (const w of props.windows) {
    for (let d = 0; d < 7; d++) {
      byDay[d].push({ ...w, _dayIndex: d })
    }
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

const findSpecialist = (id) => props.specialists.find(u => u.specialistId === id)
const findApp = (id) => props.applications.find(a => a.id === id)
const specName = (w) => findSpecialist(w.specialistId)?.fullName || w.specialistId
const appName = (w) => findApp(w.applicationId)?.name || w.applicationId

const formatDate = (dateStr) => {
  const [, , d] = dateStr.split('-')
  return `${parseInt(d)}`
}
</script>

<template>
  <div
    class="week-calendar"
    :class="{ 'week-calendar--selectable': selectable }"
    @mouseleave="cancelDrag"
    @mouseup="onMouseup"
    @touchmove.passive="onTouchmove"
    @touchend="onTouchend"
  >
    <!-- Header fijo -->
    <div class="week-header">
      <div class="week-header__hours"></div>
      <div
        v-for="(date, i) in weekDates"
        :key="date"
        class="week-header__day"
        :class="{ 'week-header__day--today': i === todayIndex }"
      >
        <span class="week-header__label">{{ DAY_LABELS[i] }}</span>
        <span class="week-header__date">{{ formatDate(date) }}</span>
      </div>
    </div>

    <!-- Body scrollable -->
    <div ref="scrollContainer" class="week-scroll">
      <div class="week-body">
        <!-- Horas -->
        <div class="week-hours">
          <div v-for="h in HOURS" :key="h" class="week-hours__cell" :style="{ height: HOUR_H + 'px' }">
            {{ h }}
          </div>
        </div>

        <!-- Columnas por dia -->
        <div
          v-for="(date, dayIdx) in weekDates"
          :key="date"
          class="week-column"
          :class="{
            'week-column--today': dayIdx === todayIndex,
            'week-column--drag-active': dragging && dragDay === dayIdx,
          }"
        >
          <!-- Celdas interactivas por hora -->
          <div
            v-for="(h, hourIdx) in HOURS"
            :key="h"
            class="week-column__cell"
            :style="{ height: HOUR_H + 'px' }"
            :data-day="dayIdx"
            :data-hour="hourIdx"
            @mousedown.prevent="onCellMousedown(dayIdx, hourIdx)"
            @mouseenter="onCellMouseenter(dayIdx, hourIdx)"
            @touchstart="onCellTouchstart(dayIdx, hourIdx, $event)"
          ></div>

          <!-- Preview de seleccion -->
          <div
            v-if="dragging && dragDay === dayIdx"
            class="drag-preview"
            :style="selectionStyle"
          >
            <span class="drag-preview__label">{{ selectionLabel }}</span>
          </div>

          <!-- Bloques de ventanas -->
          <WindowBlock
            v-for="w in windowsByDay[dayIdx]"
            :key="`${w.id}-${dayIdx}`"
            :window="w"
            :specialist-name="specName(w)"
            :application-name="appName(w)"
            :hour-height="HOUR_H"
            :base-hour="BASE_HOUR"
            :col="w._col"
            :total-cols="w._totalCols"
            @click="$emit('select', w)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-calendar {
  background: white;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
}

/* ---- Header fijo ---- */
.week-header {
  display: grid;
  grid-template-columns: 2.8rem repeat(7, 1fr);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.week-header__hours {
  border-right: 1px solid var(--border-light);
}

.week-header__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0;
  border-right: 1px solid var(--border-light);
  gap: 0.1rem;
  min-width: 0;
}

.week-header__day:last-child {
  border-right: none;
}

.week-header__day--today {
  background: #eff6ff;
}

.week-header__label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.week-header__date {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.week-header__day--today .week-header__date {
  background: #2563eb;
  color: white;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

/* ---- Scroll container ---- */
.week-scroll {
  overflow-y: auto;
  max-height: 34rem;
  -webkit-overflow-scrolling: touch;
}

/* ---- Body ---- */
.week-body {
  display: grid;
  grid-template-columns: 2.8rem repeat(7, 1fr);
}

.week-hours {
  border-right: 1px solid var(--border-light);
}

.week-hours__cell {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  font-size: 0.6rem;
  color: var(--text-secondary);
  padding-top: 0.15rem;
  border-bottom: 1px solid #f1f5f9;
}

.week-column {
  position: relative;
  border-right: 1px solid var(--border-light);
}

.week-column:last-child {
  border-right: none;
}

.week-column--today {
  background: #f8fbff;
}

.week-column__cell {
  border-bottom: 1px solid #f1f5f9;
  position: relative;
}

.week-calendar--selectable .week-column__cell {
  cursor: crosshair;
}

.week-calendar--selectable .week-column__cell:hover {
  background: rgba(42, 199, 143, 0.04);
}

/* ---- Drag preview ---- */
.drag-preview {
  position: absolute;
  left: 4%;
  width: 90%;
  background: rgba(42, 199, 143, 0.15);
  border: 2px dashed var(--primary-500);
  border-radius: 6px;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: preview-in 0.1s ease;
}

.drag-preview__label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--primary-700);
  background: rgba(255, 255, 255, 0.85);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

@keyframes preview-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.week-column--drag-active {
  background: rgba(42, 199, 143, 0.02);
}

/* ---- Mobile ---- */
@media (max-width: 768px) {
  .week-header,
  .week-body {
    grid-template-columns: 2.2rem repeat(7, 1fr);
  }

  .week-header__label {
    font-size: 0.55rem;
  }

  .week-header__date {
    font-size: 0.8rem;
  }

  .week-header__day--today .week-header__date {
    width: 1.35rem;
    height: 1.35rem;
    font-size: 0.65rem;
  }

  .week-hours__cell {
    font-size: 0.5rem;
    padding-top: 0.1rem;
  }

  .week-scroll {
    max-height: 28rem;
  }

  .drag-preview__label {
    font-size: 0.6rem;
    padding: 0.1rem 0.3rem;
  }
}

@media (max-width: 480px) {
  .week-header,
  .week-body {
    grid-template-columns: 1.8rem repeat(7, 1fr);
  }

  .week-header__label {
    font-size: 0.45rem;
    letter-spacing: -0.02em;
  }

  .week-header__date {
    font-size: 0.7rem;
  }

  .week-hours__cell {
    font-size: 0.42rem;
  }

  .week-scroll {
    max-height: 24rem;
  }
}
</style>

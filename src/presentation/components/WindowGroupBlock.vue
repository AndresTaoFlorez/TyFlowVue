<script setup>
import { computed } from 'vue'

const props = defineProps({
  group: { type: Object, required: true },
  hourHeight: { type: Number, default: 60 },
  baseHour: { type: Number, default: 0 },
  col: { type: Number, default: 0 },
  totalCols: { type: Number, default: 1 },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  selectedIds: { type: Object, default: () => new Set() },
  cutIds: { type: Object, default: () => new Set() },
})

const emit = defineEmits(['click', 'resize-start'])

const groupTop = () => Math.max(0, (props.group.startHour - props.baseHour) * props.hourHeight + 2)
const groupHeight = () => Math.max(props.hourHeight / 2, (props.group.endHour - props.group.startHour) * props.hourHeight - 4)
const left = () => props.totalCols === 1 ? '3%' : `${(props.col / props.totalCols) * 92 + 2}%`
const width = () => props.totalCols === 1 ? '92%' : `${92 / props.totalCols}%`

const count = () => props.group.windows.length

// Group is "selected" if ANY window inside is selected
const hasSelected = computed(() => props.group.windows.some(w => props.selectedIds.has(w.id)))
// Group is "all selected" if every window is selected
const allSelected = computed(() => props.group.windows.every(w => props.selectedIds.has(w.id)))
// Group is "all cut" if every window is cut
const allCut = computed(() => props.group.windows.length > 0 && props.group.windows.every(w => props.cutIds.has(w.id)))
// Any window inactive
const hasInactive = computed(() => props.group.windows.some(w => !w.isActive))
const allInactive = computed(() => props.group.windows.every(w => !w.isActive))

// Sub-bar data for each window in the group
const subBars = () => {
  const gStart = props.group.startHour
  const gDuration = props.group.endHour - gStart
  if (gDuration <= 0) return []
  const total = props.group.windows.length
  const gH = groupHeight()

  return props.group.windows.map((w, i) => {
    const spec = props.specialists.find(s => s.specialistId === w.specialistId)
    const app = props.applications.find(a => a.id === w.applicationId)
    const color = app?.color || app?.theme?.color || '#8b8fea'
    const initials = spec?.fullName
      ? spec.fullName.split(' ').slice(0, 2).map(p => p[0]).join('')
      : '?'

    // Vertical position within the group block
    const barTop = ((w.startHour - gStart) / gDuration) * gH
    const barHeight = Math.max(8, ((w.endHour - w.startHour) / gDuration) * gH)

    return {
      id: w.id,
      initials: initials.toUpperCase(),
      color,
      isOpen: w.isActive,
      isSelected: props.selectedIds.has(w.id),
      isCut: props.cutIds.has(w.id),
      barTop,
      barHeight,
      left: `${(i / total) * 100}%`,
      width: `${100 / total}%`,
    }
  })
}

const onHandleDown = (direction, e) => {
  e.stopPropagation()
  emit('resize-start', { direction, event: e })
}
</script>

<template>
  <div
    class="wgb"
    :class="{
      'wgb--compact': compact,
      'wgb--selected': hasSelected,
      'wgb--all-selected': allSelected,
      'wgb--cut': allCut,
      'wgb--has-inactive': hasInactive,
      'wgb--all-inactive': allInactive,
    }"
    :style="{
      top: groupTop() + 'px',
      height: groupHeight() + 'px',
      left: left(),
      width: width(),
    }"
    @click="$emit('click', group, $event)"
  >
    <!-- Resize handle top -->
    <div
      v-if="selectable"
      class="wgb__handle wgb__handle--top"
      @mousedown="onHandleDown('top', $event)"
      @touchstart.stop.prevent="onHandleDown('top', $event)"
    ></div>

    <!-- Sub-bars -->
    <div class="wgb__bars">
      <div
        v-for="bar in subBars()"
        :key="bar.id"
        class="wgb__bar"
        :class="{
          'wgb__bar--open': bar.isOpen,
          'wgb__bar--inactive': !bar.isOpen,
          'wgb__bar--selected': bar.isSelected,
          'wgb__bar--cut': bar.isCut,
        }"
        :style="{
          left: bar.left,
          width: bar.width,
          top: bar.barTop + 'px',
          height: bar.barHeight + 'px',
          '--bar-color': bar.color,
        }"
      >
        <span v-if="!compact" class="wgb__bar-initials">{{ bar.initials }}</span>
        <span v-if="compact && bar.barHeight >= 16" class="wgb__bar-initials wgb__bar-initials--compact">{{ bar.initials }}</span>
      </div>
    </div>

    <!-- Badge -->
    <div class="wgb__badge">{{ count() }}</div>

    <!-- Resize handle bottom -->
    <div
      v-if="selectable"
      class="wgb__handle wgb__handle--bottom"
      @mousedown="onHandleDown('bottom', $event)"
      @touchstart.stop.prevent="onHandleDown('bottom', $event)"
    ></div>
  </div>
</template>

<style scoped>
.wgb {
  position: absolute;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  background: rgba(30, 35, 50, 0.06);
  border: 1px solid rgba(120, 130, 230, 0.2);
  z-index: 2;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}

.wgb:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  z-index: 10;
  border-color: rgba(120, 130, 230, 0.4);
}

/* ---- Group-level selection ---- */
.wgb--selected {
  outline: 2px solid rgba(96, 165, 250, 0.6);
  outline-offset: -1px;
}

.wgb--all-selected {
  outline: 2px solid #60a5fa;
  outline-offset: -1px;
  filter: brightness(1.08);
}

/* Group-level cut */
.wgb--cut {
  opacity: 0.35;
  filter: grayscale(0.5);
}

/* Group-level inactive */
.wgb--all-inactive {
  opacity: 0.5;
  border-color: rgba(90, 96, 117, 0.3);
}

.wgb--has-inactive:not(.wgb--all-inactive) {
  border-style: dashed;
}

/* ---- Sub-bars container ---- */
.wgb__bars {
  position: absolute;
  inset: 0;
}

.wgb__bar {
  position: absolute;
  border-radius: 3px;
  background: color-mix(in srgb, var(--bar-color) 20%, transparent);
  border-left: 3px solid var(--bar-color);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.2rem;
  box-sizing: border-box;
  transition: filter 0.12s;
}

.wgb__bar--open {
  background: color-mix(in srgb, var(--bar-color) 28%, transparent);
}

/* Inactive bar — muted, hatched pattern */
.wgb__bar--inactive {
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--bar-color) 12%, transparent),
    color-mix(in srgb, var(--bar-color) 12%, transparent) 3px,
    color-mix(in srgb, var(--bar-color) 6%, transparent) 3px,
    color-mix(in srgb, var(--bar-color) 6%, transparent) 6px
  );
  border-left-color: color-mix(in srgb, var(--bar-color) 40%, #5a6075);
  opacity: 0.55;
}

.wgb__bar--inactive .wgb__bar-initials {
  color: color-mix(in srgb, var(--bar-color) 50%, #8890a4);
}

/* Per-bar selected */
.wgb__bar--selected {
  outline: 2px solid #60a5fa;
  outline-offset: -1px;
  filter: brightness(1.15);
}

/* Per-bar cut */
.wgb__bar--cut {
  opacity: 0.35;
  border-left-style: dashed;
  filter: grayscale(0.6);
}

.wgb:hover .wgb__bar {
  filter: brightness(1.1);
}

.wgb__bar-initials {
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--bar-color);
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
}

/* ---- Badge ---- */
.wgb__badge {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 0.5rem;
  font-weight: 800;
  color: white;
  background: rgba(60, 65, 80, 0.7);
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 2;
}

/* ---- Resize handles ---- */
.wgb__handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  z-index: 3;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.wgb:hover .wgb__handle {
  opacity: 1;
}

.wgb__handle::after {
  content: '';
  width: 24px;
  height: 3px;
  border-radius: 2px;
  background: rgba(100, 110, 140, 0.5);
}

.wgb__handle--top {
  top: 0;
}

.wgb__handle--bottom {
  bottom: 0;
}

/* Compact mode */
.wgb--compact {
  border-radius: 2px;
}

.wgb--compact .wgb__badge {
  font-size: 0.4rem;
  width: 0.7rem;
  height: 0.7rem;
  top: 1px;
  right: 1px;
}

.wgb--compact .wgb__bar {
  border-left-width: 2px;
  padding-top: 0;
  align-items: center;
}

.wgb__bar-initials--compact {
  font-size: 0.4rem;
  color: rgba(255, 255, 255, 0.9);
}
</style>

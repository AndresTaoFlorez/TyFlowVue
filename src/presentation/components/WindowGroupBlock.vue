<script setup>
import { computed } from 'vue'

function getLuminance(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  const toLinear = c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

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
    const fullName = spec?.fullName ?? ''
    const initials = fullName
      ? fullName.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
      : '?'

    // Vertical position within the group block
    const barTop = ((w.startHour - gStart) / gDuration) * gH
    const barHeight = Math.max(8, ((w.endHour - w.startHour) / gDuration) * gH)

    // Text color based on luminance
    const isDark = getLuminance(color) < 0.45
    const textColor = isDark
      ? 'color-mix(in oklch, var(--bar-color) 70%, white)'
      : 'color-mix(in oklch, var(--bar-color) 70%, black)'

    return {
      id: w.id,
      label: fullName || initials,
      initials,
      color,
      textColor,
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
  <div class="wgb" :class="{
    'wgb--compact': compact,
    'wgb--selected': hasSelected,
    'wgb--all-selected': allSelected,
    'wgb--cut': allCut,
    'wgb--has-inactive': hasInactive,
    'wgb--all-inactive': allInactive,
  }" :style="{
    top: groupTop() + 'px',
    height: groupHeight() + 'px',
    left: left(),
    width: width(),
  }" @click="$emit('click', group, $event)">
    <!-- Resize handle top -->
    <div v-if="selectable" class="wgb__handle wgb__handle--top" @mousedown="onHandleDown('top', $event)"
      @touchstart.stop.prevent="onHandleDown('top', $event)"></div>

    <!-- Sub-bars -->
    <div class="wgb__bars">
      <div v-for="bar in subBars()" :key="bar.id" class="wgb__bar" :class="{
        'wgb__bar--open': bar.isOpen,
        'wgb__bar--inactive': !bar.isOpen,
        'wgb__bar--selected': bar.isSelected,
        'wgb__bar--cut': bar.isCut,
      }" :style="{
        left: bar.left,
        width: bar.width,
        top: bar.barTop + 'px',
        height: bar.barHeight + 'px',
        '--bar-color': bar.color,
        '--bar-text-color': bar.textColor,
      }">
        <template v-if="!compact">
          <span class="wgb__bar-name">{{ bar.label }}</span>
          <span class="wgb__bar-initials">{{ bar.initials }}</span>
        </template>
        <span v-if="compact && bar.barHeight >= 16" class="wgb__bar-initials wgb__bar-initials--compact">{{ bar.initials }}</span>
      </div>
    </div>

    <!-- Badge -->
    <div class="wgb__badge">{{ count() }}</div>

    <!-- Resize handle bottom -->
    <div v-if="selectable" class="wgb__handle wgb__handle--bottom" @mousedown="onHandleDown('bottom', $event)"
      @touchstart.stop.prevent="onHandleDown('bottom', $event)"></div>
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
  box-sizing: border-box;
  padding: 4px 2px;
  transition: filter 0.12s;
  container-type: size;
}

.wgb__bar--open {
  background: color-mix(in srgb, var(--bar-color) 28%, transparent);
}

/* Inactive bar — muted, hatched pattern */
.wgb__bar--inactive {
  background: repeating-linear-gradient(-45deg,
      color-mix(in srgb, var(--bar-color) 12%, transparent),
      color-mix(in srgb, var(--bar-color) 12%, transparent) 3px,
      color-mix(in srgb, var(--bar-color) 6%, transparent) 3px,
      color-mix(in srgb, var(--bar-color) 6%, transparent) 6px);
  border-left-color: color-mix(in srgb, var(--bar-color) 40%, #5a6075);
  opacity: 0.55;
}

.wgb__bar--inactive .wgb__bar-name,
.wgb__bar--inactive .wgb__bar-initials {
  opacity: 0.7;
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

/* Full name — shown when bar is wide enough */
.wgb__bar-name {
  font-size: clamp(0.55rem, 50cqh, 0.8rem);
  font-weight: 700;
  color: var(--bar-text-color);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: left;
  padding: 0 4px;
}

/* Initials — shown when bar is too narrow for full name */
.wgb__bar-initials {
  font-size: clamp(0.4rem, 45cqh, 0.7rem);
  font-weight: 800;
  color: var(--bar-text-color);
  line-height: 1;
  text-transform: uppercase;
  text-align: center;
  width: 100%;
  overflow: hidden;
}

/* Default: wide bars (>80px) — show full name, hide initials */
.wgb__bar-name { display: block; }
.wgb__bar-initials:not(.wgb__bar-initials--compact) { display: none; }

/* Narrow bars (<80px) — show initials, hide name */
@container (max-width: 80px) {
  .wgb__bar-name { display: none; }
  .wgb__bar-initials:not(.wgb__bar-initials--compact) { display: block; }
  .wgb__bar-name,
  .wgb__bar-initials { padding: 0; }
}


/* ---- Badge ---- */
.wgb__badge {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 0.6rem;
  font-weight: 800;
  color: white;
  background: rgba(30, 35, 55, 0.85);
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 2;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.25);
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
  font-size: 0.45rem;
  width: 0.85rem;
  height: 0.85rem;
  top: 1px;
  right: 1px;
}

.wgb--compact .wgb__bar {
  border-left-width: 2px;
  padding-top: 0;
  align-items: center;
}

.wgb__bar-initials--compact {
  text-transform: uppercase;
}
</style>

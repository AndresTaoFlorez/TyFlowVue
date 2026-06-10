<script setup>
import { computed, ref } from 'vue'
import { useElementSize, fitFontSize } from '@/presentation/composables/useAdaptiveFont'
import { appTintSurface } from '@/presentation/utils/color'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const prefs = usePreferencesStore()

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
  multiDayPos: { type: String, default: null }, // 'first' | 'middle' | 'last' | null
})

const emit = defineEmits(['click', 'resize-start'])

// Tamaño real del grupo para derivar tipografía adaptativa por sub-barra
const wgbEl = ref(null)
const { width: groupWidthPx } = useElementSize(wgbEl)

const groupTop = () => Math.max(0, (props.group.startHour - props.baseHour) * props.hourHeight + 2)
const groupHeight = () => Math.max(props.hourHeight / 2, (props.group.endHour - props.group.startHour) * props.hourHeight - 4)
// Llenar el ancho de la columna/día (con un hilo de separación entre sub-cols).
const left = () => props.totalCols === 1 ? '0.5%' : `${(props.col / props.totalCols) * 99 + 0.5}%`
const width = () => props.totalCols === 1 ? '99%' : `${99 / props.totalCols - 0.5}%`

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
  void prefs.theme // dep: recompute readable text on theme change
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
    const appName = app?.name || ''
    const initials = fullName
      ? fullName.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
      : '?'

    // Vertical position within the group block
    const barTop = ((w.startHour - gStart) / gDuration) * gH
    const barHeight = Math.max(8, ((w.endHour - w.startHour) / gDuration) * gH)

    // Tipografía adaptativa: ancho real de la sub-barra (grupo / nº columnas)
    const barWidth = (groupWidthPx.value || 0) / total
    const fontSize = fitFontSize(barWidth, barHeight, {
      min: 10, max: 16, base: 11, refWidth: 95, refHeight: 56,
    })

    // Fondo + texto de la sub-barra como fuente única (theme-aware). Ver utils/color.js.
    const surf = appTintSurface(color, w.isActive
      ? { lightPct: 38, darkPct: 50 }
      : { lightPct: 14, darkPct: 22 })

    return {
      id: w.id,
      label: fullName || initials,
      initials,
      appName,
      timeRange: w.timeRange || '',
      color,
      bg: surf.bg,
      textColor: surf.text,
      fontSize,
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

const showTopHandle = computed(() => {
  if (!props.selectable) return false
  if (props.multiDayPos === 'last' || props.multiDayPos === 'middle') return false
  return true
})
const showBottomHandle = computed(() => {
  if (!props.selectable) return false
  if (props.multiDayPos === 'first' || props.multiDayPos === 'middle') return false
  return true
})

const onHandleDown = (direction, e) => {
  e.stopPropagation()
  emit('resize-start', { direction, event: e })
}
</script>

<template>
  <div ref="wgbEl" class="wgb" :class="{
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
    <div v-if="showTopHandle" class="wgb__handle wgb__handle--top" @mousedown="onHandleDown('top', $event)"
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
        '--bar-bg': bar.bg,
        '--bar-text-color': bar.textColor,
        '--bar-fs': compact ? null : bar.fontSize + 'px',
      }">
        <template v-if="!compact">
          <div class="wgb__bar-head">
            <span class="wgb__bar-avatar">{{ bar.initials }}</span>
            <span class="wgb__bar-name">{{ bar.label }}</span>
          </div>
          <span class="wgb__bar-initials">{{ bar.initials }}</span>
          <span v-if="bar.timeRange && bar.barHeight > 36" class="wgb__bar-time">{{ bar.timeRange }}</span>
          <span v-if="bar.appName && bar.barHeight > 50" class="wgb__bar-app">{{ bar.appName }}</span>
        </template>
        <span v-if="compact && bar.barHeight >= 16" class="wgb__bar-initials wgb__bar-initials--compact">{{ bar.initials }}</span>
      </div>
    </div>

    <!-- Badge -->
    <div class="wgb__badge">{{ count() }}</div>

    <!-- Resize handle bottom -->
    <div v-if="showBottomHandle" class="wgb__handle wgb__handle--bottom" @mousedown="onHandleDown('bottom', $event)"
      @touchstart.stop.prevent="onHandleDown('bottom', $event)"></div>
  </div>
</template>

<style scoped>
.wgb {
  position: absolute;
  border-radius: 0;
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
  border-radius: 0;
  background: var(--bar-bg);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  box-sizing: border-box;
  padding: 4px 3px;
  transition: filter 0.12s;
  container-type: size;
  overflow: hidden;
  gap: 1px;
}

/* Inactive bar — muted, hatched pattern */
.wgb__bar--inactive {
  background: repeating-linear-gradient(-45deg,
      color-mix(in srgb, var(--bar-color) 12%, var(--wb-surface)),
      color-mix(in srgb, var(--bar-color) 12%, var(--wb-surface)) 3px,
      color-mix(in srgb, var(--bar-color) 6%, var(--wb-surface)) 3px,
      color-mix(in srgb, var(--bar-color) 6%, var(--wb-surface)) 6px);
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
  filter: grayscale(0.6);
}

.wgb:hover .wgb__bar {
  filter: brightness(1.1);
}

/* Head row (avatar + name) */
.wgb__bar-head {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  width: 100%;
  padding: 0 2px;
}

.wgb__bar-avatar {
  width: calc(var(--bar-fs, 0.6rem) * 1.4);
  height: calc(var(--bar-fs, 0.6rem) * 1.4);
  min-width: calc(var(--bar-fs, 0.6rem) * 1.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--bar-fs, 0.42rem) * 0.66);
  font-weight: 600;
  color: white;
  background: var(--bar-color);
  flex-shrink: 0;
  line-height: 1;
}

/* Full name — shown when bar is wide enough */
.wgb__bar-name {
  font-size: var(--bar-fs, clamp(0.42rem, 22cqh, 0.72rem));
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--bar-text-color);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

/* Initials — shown when bar is too narrow for full name */
.wgb__bar-initials {
  font-size: var(--bar-fs, clamp(0.4rem, 45cqh, 0.7rem));
  font-weight: 700;
  color: var(--bar-text-color);
  line-height: 1;
  text-transform: uppercase;
  text-align: center;
  width: 100%;
  overflow: hidden;
}

/* Time range */
.wgb__bar-time {
  font-size: calc(var(--bar-fs, 0.58rem) * 0.82);
  font-weight: 500;
  color: var(--bar-text-color);
  opacity: 0.85;
  padding: 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: left;
}

/* App name pill */
.wgb__bar-app {
  font-size: calc(var(--bar-fs, 0.52rem) * 0.74);
  font-weight: 500;
  color: var(--bar-text-color);
  opacity: 0.8;
  background: color-mix(in srgb, var(--bar-color) 15%, transparent);
  padding: 0.03rem 4px;
  border-radius: 2px;
  margin: 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 4px);
  text-align: left;
}

/* Default: show head (avatar+name), hide plain initials */
.wgb__bar-head { display: flex; }
.wgb__bar-initials:not(.wgb__bar-initials--compact) { display: none; }

/* Very narrow bars (<35px) — only initials fit */
@container (max-width: 35px) {
  .wgb__bar-head { display: none; }
  .wgb__bar-initials:not(.wgb__bar-initials--compact) { display: block; }
  .wgb__bar-time { display: none; }
  .wgb__bar-app { display: none; }
}


/* ---- Badge ---- */
.wgb__badge {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 0.6rem;
  font-weight: 700;
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
  border-radius: 0;
}

.wgb--compact .wgb__badge {
  font-size: 0.45rem;
  width: 0.85rem;
  height: 0.85rem;
  top: 1px;
  right: 1px;
}

.wgb--compact .wgb__bar {
  padding-top: 0;
  align-items: center;
}

.wgb__bar-initials--compact {
  text-transform: uppercase;
}
</style>

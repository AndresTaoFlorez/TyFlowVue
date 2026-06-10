<script setup>
import { computed, ref } from 'vue'
import { useAdaptiveFont } from '@/presentation/composables/useAdaptiveFont'
import { appTintSurface } from '@/presentation/utils/color'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const prefs = usePreferencesStore()

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  applicationName: { type: String, default: '—' },
  appColor: { type: String, default: null },
  hourHeight: { type: Number, default: 60 },
  baseHour: { type: Number, default: 0 },
  col: { type: Number, default: 0 },
  totalCols: { type: Number, default: 1 },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  cut: { type: Boolean, default: false },
  inherited: { type: Boolean, default: false },
  inheritLabel: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  multiDayPos: { type: String, default: null }, // 'first' | 'middle' | 'last' | null
})

const resolvedColor = () => props.appColor || '#2AC78F'

// Fondo + texto del bloque como fuente única (theme-aware). En dark mode usa
// más proporción de color sobre --wb-surface (casi-negro) para no enturbiarlo.
// Depende de `prefs.theme` para recalcular al cambiar de tema. Ver utils/color.js.
const surface = computed(() => {
  void prefs.theme
  return appTintSurface(resolvedColor())
})

const emit = defineEmits(['click', 'resize-start'])

const initials = computed(() => {
  if (!props.specialistName) return '?'
  return props.specialistName
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

const shortTime = computed(() => {
  if (!props.window?.startTime) return ''
  const [h] = props.window.startTime.split(':').map(Number)
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
})

const top = () => Math.max(0, (props.window.startHour - props.baseHour) * props.hourHeight + 2)
const height = () => Math.max(props.hourHeight / 2, (props.window.endHour - props.window.startHour) * props.hourHeight - 4)
// Llenar el ancho de la columna/día (con un hilo de separación entre sub-cols).
const left = () => props.totalCols === 1 ? '0.5%' : `${(props.col / props.totalCols) * 99 + 0.5}%`
const width = () => props.totalCols === 1 ? '99%' : `${99 / props.totalCols - 0.5}%`

const statusClass = () => {
  if (!props.window.isActive) return 'wb--inactive'
  return 'wb--open'
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
const showSideHandles = computed(() => {
  if (!props.selectable) return false
  if (props.multiDayPos === 'middle') return false
  return true
})

const onHandleDown = (direction, e) => {
  e.stopPropagation()
  emit('resize-start', { direction, event: e })
}

// Tipografía adaptativa según el tamaño real del bloque + viewport
const wbEl = ref(null)
const { fontSize } = useAdaptiveFont(wbEl, {
  min: 11, max: 18, base: 12, refWidth: 150, refHeight: 64,
})
</script>

<template>
  <div ref="wbEl" class="wb" :class="[statusClass(), { 'wb--selected': selected, 'wb--cut': cut, 'wb--compact': compact }]" :style="{
    top: top() + 'px',
    height: height() + 'px',
    left: left(),
    width: width(),
    '--app-color': resolvedColor(),
    '--app-bg': surface.bg,
    '--app-text-color': surface.text,
    '--wb-fs': fontSize + 'px',
  }" @click="$emit('click', window, $event)">
    <!-- Resize handle top -->
    <div v-if="showTopHandle" class="wb__handle wb__handle--top" @mousedown="onHandleDown('top', $event)"
      @touchstart.stop.prevent="onHandleDown('top', $event)"></div>

    <!-- Resize handle left -->
    <div v-if="showSideHandles" class="wb__handle wb__handle--left" @mousedown="onHandleDown('left', $event)"
      @touchstart.stop.prevent="onHandleDown('left', $event)"></div>

    <template v-if="!compact">
      <div class="wb__head">
        <span class="wb__avatar">{{ initials }}</span>
        <span class="wb__name">
          <i v-if="inherited" class='bx bx-link wb__inherit-icon'></i>
          {{ specialistName }}
        </span>
      </div>
      <span v-if="height() > 42" class="wb__time">{{ window.timeRange }}</span>
      <span v-if="height() > 60" class="wb__app">{{ applicationName }}</span>
      <span v-if="inheritLabel && height() > 48" class="wb__inherit-label" :title="inheritLabel">{{ inheritLabel
        }}</span>
    </template>

    <template v-if="compact && height() >= 16">
      <span class="wb__compact-initials">{{ initials }}</span>
      <span v-if="height() >= 30" class="wb__compact-time">{{ shortTime }}</span>
    </template>

    <!-- Resize handle bottom -->
    <div v-if="showBottomHandle" class="wb__handle wb__handle--bottom" @mousedown="onHandleDown('bottom', $event)"
      @touchstart.stop.prevent="onHandleDown('bottom', $event)"></div>

    <!-- Resize handle right -->
    <div v-if="showSideHandles" class="wb__handle wb__handle--right" @mousedown="onHandleDown('right', $event)"
      @touchstart.stop.prevent="onHandleDown('right', $event)"></div>
  </div>
</template>

<style scoped>
.wb {
  position: absolute;
  border-radius: 0;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  overflow: hidden;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  transition: transform 0.1s ease, box-shadow 0.15s ease, filter 0.15s ease;
  container-type: size;
}

.wb:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  filter: brightness(1.15);
  z-index: 10;
}

.wb:active {
  transform: scale(0.99);
}

/* ── Open — app-color surface computed by utils/color.js (theme-aware) ── */
.wb--open {
  background: var(--app-bg);
}

.wb--open .wb__name {
  color: var(--app-text-color);
}

.wb--open .wb__time {
  color: var(--app-text-color);
  opacity: 0.85;
}

.wb--open .wb__app {
  color: var(--app-text-color);
  opacity: 0.9;
}

/* ── Head (avatar + name row) ── */
.wb__head {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

.wb__avatar {
  width: calc(var(--wb-fs, 0.8rem) * 1.35);
  height: calc(var(--wb-fs, 0.8rem) * 1.35);
  min-width: calc(var(--wb-fs, 0.8rem) * 1.35);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--wb-fs, 0.54rem) * 0.6);
  font-weight: 600;
  color: white;
  background: var(--app-color);
  flex-shrink: 0;
  line-height: 1;
}

/* ── Name ── */
.wb__name {
  font-size: var(--wb-fs, clamp(0.5rem, 22cqh, 0.85rem));
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.wb__inherit-icon {
  font-size: var(--wb-fs, clamp(0.5rem, 22cqh, 0.85rem));
  opacity: 0.85;
  flex-shrink: 0;
}

/* ── Time ── */
.wb__time {
  font-size: calc(var(--wb-fs, 0.7rem) * 0.82);
  font-weight: 500;
  white-space: nowrap;
}

/* ── App ── */
.wb__app {
  font-size: calc(var(--wb-fs, 0.62rem) * 0.74);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: color-mix(in srgb, var(--app-color) 26%, var(--wb-surface));
  padding: 0.05rem 0.4rem 0.25rem;
  border-radius: 3px;
  width: fit-content;
  max-width: 100%;
}

/* ── Inherit label ── */
.wb__inherit-label {
  font-size: calc(var(--wb-fs, 0.6rem) * 0.72);
  font-weight: 500;
  color: var(--app-text-color);
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: auto;
  line-height: 1;
  letter-spacing: 0.01em;
}

/* ── Resize handles ── */
.wb__handle {
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

.wb:hover .wb__handle {
  opacity: 1;
}

.wb__handle::after {
  content: '';
  width: 24px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.5);
}

.wb__handle--top {
  top: 0;
}

.wb__handle--bottom {
  bottom: 0;
}

.wb__handle--left,
.wb__handle--right {
  top: 0;
  bottom: 0;
  left: auto;
  right: auto;
  width: 8px;
  height: auto;
  cursor: ew-resize;
  flex-direction: column;
}

.wb__handle--left {
  left: 0;
}

.wb__handle--right {
  right: 0;
}

.wb__handle--left::after,
.wb__handle--right::after {
  width: 3px;
  height: 24px;
}

/* ── Selected ── */
.wb--selected {
  outline: 2px solid #60a5fa;
  outline-offset: -1px;
  filter: brightness(1.1);
}

/* ── Cut ── */
.wb--cut {
  opacity: 0.4;
  filter: grayscale(0.5);
}

/* ── Inactive — muted, hatched ── */
.wb--inactive {
  background: repeating-linear-gradient(-45deg,
      color-mix(in srgb, var(--app-color) 12%, var(--wb-surface)),
      color-mix(in srgb, var(--app-color) 12%, var(--wb-surface)) 3px,
      color-mix(in srgb, var(--app-color) 6%, var(--wb-surface)) 3px,
      color-mix(in srgb, var(--app-color) 6%, var(--wb-surface)) 6px);
  opacity: 0.6;
}

.wb--inactive .wb__name {
  color: var(--text-secondary);
  opacity: 0.8;
}

.wb--inactive .wb__avatar {
  opacity: 0.6;
}

/* ── Compact (mobile week) ── */
.wb--compact .wb__handle {
  display: none;
}

.wb--compact {
  padding: 2px 1px;
  border-radius: 0;
  gap: 0;
  align-items: center;
  justify-content: center;
}

.wb__compact-initials {
  font-size: clamp(0.4rem, min(55cqh, 70cqw), 0.8rem);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  line-height: 1;
  overflow: hidden;
}

.wb__compact-time {
  font-size: clamp(0.35rem, min(35cqh, 60cqw), 0.65rem);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  line-height: 1;
  overflow: hidden;
}

.wb--compact.wb--open {
  background: color-mix(in srgb, var(--app-color) 50%, var(--wb-surface));
}

.wb--compact:hover {
  transform: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.wb--compact.wb--inactive {
  background: color-mix(in srgb, var(--app-color) 15%, var(--wb-surface));
  opacity: 0.5;
}
</style>

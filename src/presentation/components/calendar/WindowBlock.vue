<script setup>
import '@/presentation/styles/calendar/WindowBlock.css'
import { computed, ref } from 'vue'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { useAdaptiveFont } from '@/presentation/composables/useAdaptiveFont'
import { appTintSurface, readableTextOnTint } from '@/presentation/utils/color'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const prefs = usePreferencesStore()

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  specialistAvatar: { type: String, default: null },
  specialistEmoji: { type: String, default: null },
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

// Texto del badge __app: su fondo es un tinte mucho más sutil (26% sobre
// --wb-surface) que el del bloque (--app-bg, ~90% en dark), así que no puede
// reusar --app-text-color — en dark quedaba texto casi negro sobre un badge
// casi negro. Se calcula contraste propio para ese 26%.
const tagText = computed(() => {
  void prefs.theme
  return readableTextOnTint(resolvedColor(), { pct: 26 })
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
// Llenar el ancho de la columna/día dejando un pequeño aire a la derecha (estilo
// Google Calendar). El gutter es RESPONSIVE vía la variable CSS --wb-gap (6px en
// escritorio, 2px en pantallas pequeñas; ver media query), para que en móvil no
// se coma el ancho de columnas finas.
const left = () => props.totalCols === 1 ? '0.5%' : `${(props.col / props.totalCols) * 99 + 0.5}%`
const width = () => props.totalCols === 1
  ? 'calc(99% - var(--wb-gap, 6px))'
  : `calc(${99 / props.totalCols - 0.5}% - var(--wb-gap, 6px))`

const statusClass = () => {
  if (!props.window.isActive) return 'wb--inactive'
  return 'wb--open'
}

// Sellado en dos niveles (§4 de las reglas):
//  - iniciada (starts_at <= Timeline): el INICIO queda congelado → sin handle top;
//    el fin aún se puede ajustar (el store valida que no quede antes de la Timeline).
//  - finalizada (ends_at < Timeline): inmutable total → tampoco handle bottom.
// Se calcula sobre los timestamps directamente porque el proxy multi-día puede
// no conservar los getters de la entity; usa la Timeline del servidor.
const startSealed = computed(() => {
  if (!props.window?.startsAt) return false
  return WorkWindow.timelineNow() >= new Date(props.window.startsAt).getTime()
})
const ended = computed(() => {
  if (!props.window?.endsAt) return false
  return WorkWindow.timelineNow() > new Date(props.window.endsAt).getTime()
})

const showTopHandle = computed(() => {
  if (!props.selectable) return false
  if (props.multiDayPos === 'last' || props.multiDayPos === 'middle') return false
  if (startSealed.value) return false
  return true
})
const showBottomHandle = computed(() => {
  if (!props.selectable) return false
  if (props.multiDayPos === 'first' || props.multiDayPos === 'middle') return false
  if (ended.value) return false
  return true
})
const showSideHandles = computed(() => {
  if (!props.selectable) return false
  if (props.multiDayPos === 'middle') return false
  if (startSealed.value) return false
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
    '--app-tag-text': tagText,
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
        <span class="wb__avatar">
          <img v-if="specialistAvatar" :src="specialistAvatar" class="wb__avatar-img" alt="" loading="lazy" />
          <span v-else-if="specialistEmoji" class="wb__avatar-emoji" role="img">{{ specialistEmoji }}</span>
          <template v-else>{{ initials }}</template>
        </span>
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

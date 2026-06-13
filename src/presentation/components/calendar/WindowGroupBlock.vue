<script setup>
import '@/presentation/styles/calendar/WindowGroupBlock.css'
import { computed, ref } from 'vue'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { useAdaptiveFont } from '@/presentation/composables/useAdaptiveFont'
import { appTintSurface, readableTextOnTint } from '@/presentation/utils/color'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const prefs = usePreferencesStore()

// Grupo = varias ventanas con starts_at y ends_at IDÉNTICOS. Se muestran como UN
// solo bloque (igual look que WindowBlock) con una fila de avatares, uno por
// especialista, en lugar de un único wb__avatar.
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

const MAX_AVATARS = 5

const _appOf = (w) => props.applications.find(a => a.id === w.applicationId)
const _colorOf = (w) => { const a = _appOf(w); return a?.color || a?.theme?.color || '#2AC78F' }
const _initials = (name) => name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?'

// Color por defecto del GRUPO: el primary #2AC78F (un grupo puede mezclar apps,
// así que su identidad es neutra/primary). appTintSurface adapta light/dark.
// Los avatares sí llevan el color de su propia app.
const GROUP_COLOR = '#2AC78F'
const repColor = computed(() => GROUP_COLOR)
const surface = computed(() => { void prefs.theme; return appTintSurface(repColor.value) })

// Texto del badge __app: su fondo es un tinte mucho más sutil (26% sobre
// --wb-surface) que el del bloque (--app-bg, ~90% en dark) — no puede reusar
// --app-text-color o queda texto casi negro sobre un badge casi negro.
const tagText = computed(() => { void prefs.theme; return readableTextOnTint(repColor.value, { pct: 26 }) })

const avatars = computed(() => props.group.windows.map(w => {
  const spec = props.specialists.find(s => s.specialistId === w.specialistId)
  return {
    id: w.id,
    initials: _initials(spec?.fullName || ''),
    color: _colorOf(w),
    name: spec?.fullName || '',
    avatar: spec?.preferences?.avatar_url || null,
    emoji:  spec?.preferences?.avatar_emoji || null,
  }
}))
const shownAvatars = computed(() => avatars.value.slice(0, MAX_AVATARS))
const overflowCount = computed(() => Math.max(0, avatars.value.length - MAX_AVATARS))

const count = computed(() => props.group.windows.length)
const timeRange = computed(() => props.group.windows[0]?.timeRange || '')
const appLabel = computed(() => {
  const appIds = new Set(props.group.windows.map(w => w.applicationId))
  // Misma app en todo el grupo → su nombre; varias apps → nº de especialistas.
  return appIds.size === 1 ? (_appOf(props.group.windows[0])?.name || '') : `${count.value} especialistas`
})

const top = () => Math.max(0, (props.group.startHour - props.baseHour) * props.hourHeight + 2)
const height = () => Math.max(props.hourHeight / 2, (props.group.endHour - props.group.startHour) * props.hourHeight - 4)
const left = () => props.totalCols === 1 ? '0.5%' : `${(props.col / props.totalCols) * 99 + 0.5}%`
const width = () => props.totalCols === 1
  ? 'calc(99% - var(--wb-gap, 6px))'
  : `calc(${99 / props.totalCols - 0.5}% - var(--wb-gap, 6px))`

const hasSelected = computed(() => props.group.windows.some(w => props.selectedIds.has(w.id)))
const allSelected = computed(() => props.group.windows.length > 0 && props.group.windows.every(w => props.selectedIds.has(w.id)))
const allCut = computed(() => props.group.windows.length > 0 && props.group.windows.every(w => props.cutIds.has(w.id)))
const allInactive = computed(() => props.group.windows.every(w => !w.isActive))

const statusClass = () => (allInactive.value ? 'wgb--inactive' : 'wgb--open')

// Las ventanas de un grupo comparten el rango exacto: basta inspeccionar una.
// Sellado en dos niveles (§4): iniciada → sin handle top (inicio congelado);
// finalizada → tampoco bottom. Usa la Timeline del servidor.
const startSealed = computed(() => {
  const w = props.group?.windows?.[0]
  if (!w?.startsAt) return false
  return WorkWindow.timelineNow() >= new Date(w.startsAt).getTime()
})
const ended = computed(() => {
  const w = props.group?.windows?.[0]
  if (!w?.endsAt) return false
  return WorkWindow.timelineNow() > new Date(w.endsAt).getTime()
})

const showTopHandle = computed(() => props.selectable && props.multiDayPos !== 'last' && props.multiDayPos !== 'middle' && !startSealed.value)
const showBottomHandle = computed(() => props.selectable && props.multiDayPos !== 'first' && props.multiDayPos !== 'middle' && !ended.value)
const showSideHandles = computed(() => props.selectable && props.multiDayPos !== 'middle' && !startSealed.value)

const onHandleDown = (direction, e) => {
  e.stopPropagation()
  emit('resize-start', { direction, event: e })
}

const wgbEl = ref(null)
const { fontSize } = useAdaptiveFont(wgbEl, { min: 11, max: 18, base: 12, refWidth: 150, refHeight: 64 })
// Los avatares se escalan SOLO por el ancho del contenedor (widthWeight: 1):
// no deben encogerse cuando el bloque es bajo de alto.
const { fontSize: avatarFs } = useAdaptiveFont(wgbEl, { min: 11, max: 18, base: 12, refWidth: 150, widthWeight: 1 })
</script>

<template>
  <div ref="wgbEl" class="wgb" :class="[statusClass(), {
    'wgb--selected': allSelected,
    'wgb--some-selected': hasSelected && !allSelected,
    'wgb--cut': allCut,
    'wgb--compact': compact,
  }]" :data-window-ids="group.windows.map(w => w.id).join(',')" :style="{
    top: top() + 'px',
    height: height() + 'px',
    left: left(),
    width: width(),
    '--app-color': repColor,
    '--app-bg': surface.bg,
    '--app-text-color': surface.text,
    '--app-tag-text': tagText,
    '--wb-fs': fontSize + 'px',
    '--wb-av': avatarFs + 'px',
  }" @click="$emit('click', group, $event)">
    <!-- Resize handle top -->
    <div v-if="showTopHandle" class="wgb__handle wgb__handle--top" @mousedown="onHandleDown('top', $event)"
      @touchstart.stop.prevent="onHandleDown('top', $event)"></div>
    <!-- Resize handle left -->
    <div v-if="showSideHandles" class="wgb__handle wgb__handle--left" @mousedown="onHandleDown('left', $event)"
      @touchstart.stop.prevent="onHandleDown('left', $event)"></div>

    <template v-if="!compact">
      <div class="wgb__head">
        <span v-for="a in shownAvatars" :key="a.id" class="wgb__avatar" :style="{ background: a.color }" :title="a.name">
          <img v-if="a.avatar" :src="a.avatar" class="wgb__avatar-img" alt="" loading="lazy" />
          <span v-else-if="a.emoji" class="wgb__avatar-emoji" role="img">{{ a.emoji }}</span>
          <template v-else>{{ a.initials }}</template>
        </span>
        <span v-if="overflowCount > 0" class="wgb__avatar wgb__avatar--more">+{{ overflowCount }}</span>
      </div>
      <span v-if="height() > 42" class="wgb__time">{{ timeRange }}</span>
      <span v-if="appLabel && height() > 60" class="wgb__app">{{ appLabel }}</span>
    </template>

    <template v-if="compact && height() >= 16">
      <div class="wgb__head wgb__head--compact">
        <span v-for="a in shownAvatars" :key="a.id" class="wgb__avatar wgb__avatar--compact" :style="{ background: a.color }">
          <img v-if="a.avatar" :src="a.avatar" class="wgb__avatar-img" alt="" loading="lazy" />
          <span v-else-if="a.emoji" class="wgb__avatar-emoji" role="img">{{ a.emoji }}</span>
          <template v-else>{{ a.initials }}</template>
        </span>
        <span v-if="overflowCount > 0" class="wgb__avatar wgb__avatar--compact wgb__avatar--more">+{{ overflowCount }}</span>
      </div>
    </template>

    <!-- Resize handle bottom -->
    <div v-if="showBottomHandle" class="wgb__handle wgb__handle--bottom" @mousedown="onHandleDown('bottom', $event)"
      @touchstart.stop.prevent="onHandleDown('bottom', $event)"></div>
    <!-- Resize handle right -->
    <div v-if="showSideHandles" class="wgb__handle wgb__handle--right" @mousedown="onHandleDown('right', $event)"
      @touchstart.stop.prevent="onHandleDown('right', $event)"></div>
  </div>
</template>

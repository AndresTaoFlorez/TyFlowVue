<script setup>
import { computed, ref } from 'vue'
import { useAdaptiveFont } from '@/presentation/composables/useAdaptiveFont'
import { appTintSurface } from '@/presentation/utils/color'
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

const avatars = computed(() => props.group.windows.map(w => {
  const spec = props.specialists.find(s => s.specialistId === w.specialistId)
  return { id: w.id, initials: _initials(spec?.fullName || ''), color: _colorOf(w), name: spec?.fullName || '' }
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

const showTopHandle = computed(() => props.selectable && props.multiDayPos !== 'last' && props.multiDayPos !== 'middle')
const showBottomHandle = computed(() => props.selectable && props.multiDayPos !== 'first' && props.multiDayPos !== 'middle')
const showSideHandles = computed(() => props.selectable && props.multiDayPos !== 'middle')

const onHandleDown = (direction, e) => {
  e.stopPropagation()
  emit('resize-start', { direction, event: e })
}

const wgbEl = ref(null)
const { fontSize } = useAdaptiveFont(wgbEl, { min: 11, max: 18, base: 12, refWidth: 150, refHeight: 64 })
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
    '--wb-fs': fontSize + 'px',
  }" @click="$emit('click', group, $event)">
    <!-- Resize handle top -->
    <div v-if="showTopHandle" class="wgb__handle wgb__handle--top" @mousedown="onHandleDown('top', $event)"
      @touchstart.stop.prevent="onHandleDown('top', $event)"></div>
    <!-- Resize handle left -->
    <div v-if="showSideHandles" class="wgb__handle wgb__handle--left" @mousedown="onHandleDown('left', $event)"
      @touchstart.stop.prevent="onHandleDown('left', $event)"></div>

    <template v-if="!compact">
      <div class="wgb__head">
        <span v-for="a in shownAvatars" :key="a.id" class="wgb__avatar" :style="{ background: a.color }"
          :title="a.name">{{ a.initials }}</span>
        <span v-if="overflowCount > 0" class="wgb__avatar wgb__avatar--more">+{{ overflowCount }}</span>
      </div>
      <span v-if="height() > 42" class="wgb__time">{{ timeRange }}</span>
      <span v-if="appLabel && height() > 60" class="wgb__app">{{ appLabel }}</span>
    </template>

    <template v-if="compact && height() >= 16">
      <div class="wgb__head wgb__head--compact">
        <span v-for="a in shownAvatars" :key="a.id" class="wgb__avatar wgb__avatar--compact"
          :style="{ background: a.color }">{{ a.initials }}</span>
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

<style scoped>
/* Mismo look que WindowBlock (.wb): un solo bloque con el color de la app. */
.wgb {
  position: absolute;
  /* Rounded muy leve, estilo iOS (igual que WindowBlock). */
  border-radius: var(--wb-radius, 4px);
  --wb-gap: 6px;
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

/* Pantallas pequeñas: gutter mínimo + sombra sutil a la derecha. */
@media (max-width: 768px) {
  .wgb { --wb-gap: 2px; }
  .wgb::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(to right, transparent, rgba(15, 23, 42, 0.14));
    border-top-right-radius: inherit;
    border-bottom-right-radius: inherit;
    pointer-events: none;
  }
}

.wgb:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  filter: brightness(1.15);
  z-index: 10;
}
.wgb:active { transform: scale(0.99); }

.wgb--open { background: var(--app-bg); }
.wgb--open .wgb__time,
.wgb--open .wgb__app { color: var(--app-text-color); }

/* Inactiva — patrón rayado tenue, como WindowBlock. */
.wgb--inactive {
  background: repeating-linear-gradient(-45deg,
      color-mix(in srgb, var(--app-color) 12%, var(--wb-surface)),
      color-mix(in srgb, var(--app-color) 12%, var(--wb-surface)) 4px,
      color-mix(in srgb, var(--app-color) 6%, var(--wb-surface)) 4px,
      color-mix(in srgb, var(--app-color) 6%, var(--wb-surface)) 8px);
  opacity: 0.7;
}

/* ── Fila de avatares (uno por especialista) ── */
.wgb__head {
  display: flex;
  align-items: center;
  min-width: 0;
  flex-wrap: nowrap;
}

.wgb__avatar {
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
  /* Anillo del color del bloque para separar avatares solapados. */
  box-shadow: 0 0 0 1.5px var(--app-bg);
  margin-left: calc(var(--wb-fs, 0.8rem) * -0.32);
}
.wgb__head > .wgb__avatar:first-child { margin-left: 0; }

.wgb__avatar--more {
  background: color-mix(in srgb, var(--app-color) 55%, #334155);
  font-size: calc(var(--wb-fs, 0.5rem) * 0.55);
}

/* ── Time ── */
.wgb__time {
  font-size: calc(var(--wb-fs, 0.7rem) * 0.82);
  font-weight: 500;
  white-space: nowrap;
}

/* ── App / resumen ── */
.wgb__app {
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

/* ── Selección (mismo doble anillo fuerte que WindowBlock) ── */
.wgb--selected {
  outline: 3px solid #1d4ed8;
  outline-offset: -3px;
  box-shadow: inset 0 0 0 2px #ffffff;
  filter: saturate(1.2);
  z-index: 5;
}
.wgb--some-selected {
  outline: 2px dashed #1d4ed8;
  outline-offset: -2px;
  z-index: 5;
}

/* ── Cut ── */
.wgb--cut {
  opacity: 0.4;
  filter: grayscale(0.5);
}

/* ── Compact ── */
.wgb--compact {
  padding: 2px 3px;
  align-items: center;
}
.wgb__head--compact { justify-content: center; }
.wgb__avatar--compact {
  width: calc(var(--wb-fs, 0.7rem) * 1.1);
  height: calc(var(--wb-fs, 0.7rem) * 1.1);
  min-width: calc(var(--wb-fs, 0.7rem) * 1.1);
  font-size: calc(var(--wb-fs, 0.5rem) * 0.5);
}

/* ── Resize handles (igual que WindowBlock) ── */
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
.wgb:hover .wgb__handle { opacity: 1; }
.wgb__handle::after {
  content: '';
  width: 24px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.5);
}
.wgb__handle--top { top: 0; }
.wgb__handle--bottom { bottom: 0; }
.wgb__handle--left,
.wgb__handle--right {
  top: 0;
  bottom: 0;
  left: auto;
  right: auto;
  width: 8px;
  height: auto;
  cursor: ew-resize;
  flex-direction: column;
}
.wgb__handle--left { left: 0; }
.wgb__handle--right { right: 0; }
.wgb__handle--left::after,
.wgb__handle--right::after { width: 3px; height: 24px; }
</style>

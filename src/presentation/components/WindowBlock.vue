<script setup>
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
})

const resolvedColor = () => props.appColor || '#2AC78F'

const emit = defineEmits(['click', 'resize-start'])

const top = () => Math.max(0, (props.window.startHour - props.baseHour) * props.hourHeight + 2)
const height = () => Math.max(props.hourHeight / 2, (props.window.endHour - props.window.startHour) * props.hourHeight - 4)
const left = () => props.totalCols === 1 ? '3%' : `${(props.col / props.totalCols) * 92 + 2}%`
const width = () => props.totalCols === 1 ? '92%' : `${92 / props.totalCols}%`

const statusClass = () => {
  if (!props.window.isActive) return 'wb--inactive'
  return 'wb--open'
}

const onHandleDown = (direction, e) => {
  e.stopPropagation()
  emit('resize-start', { direction, event: e })
}
</script>

<template>
  <div
    class="wb"
    :class="[statusClass(), { 'wb--selected': selected, 'wb--cut': cut }]"
    :style="{
      top: top() + 'px',
      height: height() + 'px',
      left: left(),
      width: width(),
      '--app-color': resolvedColor(),
    }"
    @click="$emit('click', window)"
  >
    <!-- Resize handle top -->
    <div
      v-if="selectable"
      class="wb__handle wb__handle--top"
      @mousedown="onHandleDown('top', $event)"
      @touchstart.stop.prevent="onHandleDown('top', $event)"
    ></div>

    <!-- Resize handle left -->
    <div
      v-if="selectable"
      class="wb__handle wb__handle--left"
      @mousedown="onHandleDown('left', $event)"
      @touchstart.stop.prevent="onHandleDown('left', $event)"
    ></div>

    <span class="wb__name">
      <i v-if="inherited" class='bx bx-link wb__inherit-icon'></i>
      {{ specialistName }}
    </span>
    <span v-if="height() > 42" class="wb__time">{{ window.timeRange }}</span>
    <span v-if="height() > 60" class="wb__app">{{ applicationName }}</span>

    <!-- Resize handle bottom -->
    <div
      v-if="selectable"
      class="wb__handle wb__handle--bottom"
      @mousedown="onHandleDown('bottom', $event)"
      @touchstart.stop.prevent="onHandleDown('bottom', $event)"
    ></div>

    <!-- Resize handle right -->
    <div
      v-if="selectable"
      class="wb__handle wb__handle--right"
      @mousedown="onHandleDown('right', $event)"
      @touchstart.stop.prevent="onHandleDown('right', $event)"
    ></div>
  </div>
</template>

<style scoped>
.wb {
  position: absolute;
  border-radius: 4px;
  padding: 0.3rem 0.45rem;
  cursor: pointer;
  overflow: hidden;
  border-left: 3px solid;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  transition: transform 0.1s ease, box-shadow 0.15s ease, filter 0.15s ease;
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

/* Resize handles */
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

/* Open — uses app color */
.wb--open {
  background: color-mix(in srgb, var(--app-color) 22%, transparent);
  border-left-color: var(--app-color);
}
.wb--open .wb__name { color: color-mix(in srgb, var(--app-color) 70%, white); }
.wb--open .wb__time { color: color-mix(in srgb, var(--app-color) 60%, white); }
.wb--open .wb__app { color: color-mix(in srgb, var(--app-color) 55%, white); }

/* Selected — highlighted */
.wb--selected {
  outline: 2px solid #60a5fa;
  outline-offset: -1px;
  filter: brightness(1.1);
}

/* Cut — dashed border, tenue */
.wb--cut {
  opacity: 0.4;
  border-left-style: dashed;
  filter: grayscale(0.5);
}

/* Inactive — muted */
.wb--inactive {
  background: rgba(100, 110, 130, 0.15);
  border-left-color: #5a6075;
  opacity: 0.5;
}
.wb--inactive .wb__name { color: #8890a4; }

.wb__name {
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.wb__inherit-icon {
  font-size: 0.72rem;
  opacity: 0.85;
  flex-shrink: 0;
}

.wb__time {
  font-size: 0.6rem;
  font-weight: 500;
  white-space: nowrap;
}

.wb__app {
  font-size: 0.56rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

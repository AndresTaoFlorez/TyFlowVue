<script setup>
const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  applicationName: { type: String, default: '—' },
  hourHeight: { type: Number, default: 52 },
  baseHour: { type: Number, default: 8 },
  col: { type: Number, default: 0 },
  totalCols: { type: Number, default: 1 },
})

defineEmits(['click'])

const top = () => (props.window.startHour - props.baseHour) * props.hourHeight + 2
const height = () => (props.window.endHour - props.window.startHour) * props.hourHeight - 4
const left = () => props.totalCols === 1 ? '4%' : `${(props.col / props.totalCols) * 93 + 2}%`
const width = () => props.totalCols === 1 ? '90%' : `${95 / props.totalCols}%`

const statusClass = () => {
  if (props.window.isSessionOpen) return 'block--open'
  if (!props.window.isActive) return 'block--inactive'
  return 'block--closed'
}
</script>

<template>
  <div
    class="window-block"
    :class="statusClass()"
    :style="{
      top: top() + 'px',
      height: height() + 'px',
      left: left(),
      width: width(),
    }"
    @click="$emit('click', window)"
  >
    <span class="window-block__name">{{ specialistName }}</span>
    <span v-if="height() > 38" class="window-block__time">{{ window.timeRange }}</span>
    <span v-if="height() > 54" class="window-block__app">{{ applicationName }}</span>
  </div>
</template>

<style scoped>
.window-block {
  position: absolute;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  overflow: hidden;
  border-left: 3px solid;
  transition: box-shadow 0.12s ease;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.window-block:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

/* Sesion abierta — verde */
.block--open {
  background: #dcfce7;
  border-left-color: #15803d;
}

/* Sesion cerrada — azul */
.block--closed {
  background: #dbeafe;
  border-left-color: #1d4ed8;
}

/* Ventana inactiva — gris */
.block--inactive {
  background: #f1f5f9;
  border-left-color: #94a3b8;
  opacity: 0.6;
}

.window-block__name {
  font-size: 0.72rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.window-block__time {
  font-size: 0.65rem;
  color: #475569;
  white-space: nowrap;
}

.window-block__app {
  font-size: 0.62rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

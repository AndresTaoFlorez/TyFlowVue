<script setup>
const props = defineProps({
  group: { type: Object, required: true },
  hourHeight: { type: Number, default: 60 },
  baseHour: { type: Number, default: 0 },
  col: { type: Number, default: 0 },
  totalCols: { type: Number, default: 1 },
  specialists: { type: Array, default: () => [] },
})

defineEmits(['click'])

const top = () => Math.max(0, (props.group.startHour - props.baseHour) * props.hourHeight + 2)
const height = () => Math.max(props.hourHeight / 2, (props.group.endHour - props.group.startHour) * props.hourHeight - 4)
const left = () => props.totalCols === 1 ? '3%' : `${(props.col / props.totalCols) * 92 + 2}%`
const width = () => props.totalCols === 1 ? '92%' : `${92 / props.totalCols}%`

const count = () => props.group.windows.length

const initials = () => {
  return props.group.windows.slice(0, 3).map(w => {
    const spec = props.specialists.find(s => s.specialistId === w.specialistId)
    if (!spec?.fullName) return '?'
    const parts = spec.fullName.split(' ')
    return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0]
  })
}

const hasOpen = () => props.group.windows.some(w => w.isSessionOpen)
</script>

<template>
  <div
    class="wgb"
    :class="{ 'wgb--has-open': hasOpen() }"
    :style="{
      top: top() + 'px',
      height: height() + 'px',
      left: left(),
      width: width(),
    }"
    @click="$emit('click', group)"
  >
    <div class="wgb__badge">{{ count() }}</div>
    <div class="wgb__initials">
      <span v-for="(ini, i) in initials()" :key="i" class="wgb__avatar">{{ ini }}</span>
      <span v-if="count() > 3" class="wgb__more">+{{ count() - 3 }}</span>
    </div>
    <span v-if="height() > 42" class="wgb__time">
      {{ Math.floor(group.startHour) }}:{{ String(Math.round((group.startHour % 1) * 60)).padStart(2, '0') }}
      –
      {{ Math.floor(group.endHour) }}:{{ String(Math.round((group.endHour % 1) * 60)).padStart(2, '0') }}
    </span>
  </div>
</template>

<style scoped>
.wgb {
  position: absolute;
  border-radius: 4px;
  padding: 0.3rem 0.4rem;
  cursor: pointer;
  overflow: hidden;
  border-left: 3px solid #8b8fea;
  background: rgba(120, 130, 230, 0.18);
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition: transform 0.1s ease, box-shadow 0.15s ease, filter 0.15s ease;
}

.wgb--has-open {
  border-left-color: #2AC78F;
  background: rgba(42, 199, 143, 0.15);
}

.wgb:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  filter: brightness(1.15);
  z-index: 10;
}

.wgb__badge {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 0.55rem;
  font-weight: 800;
  color: white;
  background: #8b8fea;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.wgb--has-open .wgb__badge {
  background: #2AC78F;
}

.wgb__initials {
  display: flex;
  gap: 0.15rem;
  margin-top: 0.1rem;
}

.wgb__avatar {
  font-size: 0.52rem;
  font-weight: 700;
  color: #b4b8f8;
  background: rgba(120, 130, 230, 0.25);
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

.wgb--has-open .wgb__avatar {
  color: #6ee7b7;
  background: rgba(42, 199, 143, 0.25);
}

.wgb__more {
  font-size: 0.5rem;
  font-weight: 700;
  color: #9ea2e8;
  display: flex;
  align-items: center;
}

.wgb__time {
  font-size: 0.55rem;
  font-weight: 500;
  color: #9ea2e8;
  white-space: nowrap;
}

.wgb--has-open .wgb__time {
  color: #5dd9a8;
}
</style>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  caseData: { type: Object, required: true },
  specialistName: { type: String, default: null },
})

const steps = computed(() => {
  const c = props.caseData
  return [
    { key: 'open', label: 'Abierto', time: c.createdAt, icon: 'bx-plus-circle' },
    { key: 'assigned', label: 'Asignado', time: c.assignedAt, icon: 'bx-user-check' },
    { key: 'in_progress', label: 'En progreso', time: null, icon: 'bx-loader' },
    { key: 'resolved', label: 'Resuelto', time: c.resolvedAt, icon: 'bx-check' },
    { key: 'closed', label: 'Cerrado', time: c.closedAt, icon: 'bx-lock' },
  ]
})

const ORDER = ['open', 'assigned', 'in_progress', 'resolved', 'closed']

function stepState(key) {
  const ci = ORDER.indexOf(props.caseData.status)
  const si = ORDER.indexOf(key)
  if (si < ci) return 'done'
  if (si === ci) return 'current'
  return 'pending'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="tl">
    <div v-for="(s, i) in steps" :key="s.key" class="tl__step" :class="`tl__step--${stepState(s.key)}`">
      <div class="tl__dot">
        <i :class="'bx ' + s.icon"></i>
      </div>
      <div v-if="i < steps.length - 1" class="tl__line"></div>
      <div class="tl__info">
        <span class="tl__label">{{ s.label }}</span>
        <span v-if="s.key === 'assigned' && specialistName" class="tl__specialist">{{ specialistName }}</span>
        <span v-if="s.time" class="tl__time">{{ fmtDate(s.time) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 0.75rem 0;
  overflow-x: auto;
  flex-shrink: 0;
}

.tl__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 80px;
}

.tl__dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  border: 2px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-secondary);
  z-index: 1;
  transition: all 0.2s;
}

.tl__line {
  position: absolute;
  top: 15px;
  left: calc(50% + 16px);
  width: calc(100% - 32px);
  height: 2px;
  background: var(--border-light);
}

.tl__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 0.4rem;
}

.tl__label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.tl__specialist {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--primary-600, #1fa672);
  margin-top: 0.1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}

.tl__time {
  font-size: 0.6rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

/* States */
.tl__step--done .tl__dot {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: white;
}

.tl__step--done .tl__line {
  background: var(--primary-500);
}

.tl__step--done .tl__label { color: var(--primary-600); }

.tl__step--current .tl__dot {
  border-color: var(--primary-500);
  color: var(--primary-500);
  box-shadow: 0 0 0 4px rgba(42, 199, 143, 0.15);
}

.tl__step--current .tl__label {
  color: var(--primary-500);
  font-weight: 700;
}

@media (max-width: 480px) {
  .tl__step { min-width: 60px; }
  .tl__dot { width: 26px; height: 26px; font-size: 0.75rem; }
  .tl__line { top: 12px; left: calc(50% + 13px); width: calc(100% - 26px); }
}
</style>

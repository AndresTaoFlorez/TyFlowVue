<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  prefill: { type: Object, default: null },
})

const emit = defineEmits(['close', 'create'])

const form = ref({
  specialistId: '',
  applicationId: '',
  startTime: '08:00',
  endTime: '17:00',
  inheritsOnReopen: false,
})

watch(() => props.visible, (val) => {
  if (!val) return
  if (props.prefill) {
    const sh = String(props.prefill.startHour).padStart(2, '0')
    const eh = String(props.prefill.endHour).padStart(2, '0')
    form.value = {
      specialistId: '',
      applicationId: '',
      startTime: `${sh}:00`,
      endTime: `${eh}:00`,
      inheritsOnReopen: false,
    }
  } else {
    form.value = {
      specialistId: '',
      applicationId: '',
      startTime: '08:00',
      endTime: '17:00',
      inheritsOnReopen: false,
    }
  }
})

const dateLabel = computed(() => {
  if (!props.prefill?.date) return null
  const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const d = new Date(props.prefill.date + 'T12:00:00')
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
})

const canSubmit = computed(() =>
  form.value.specialistId && form.value.applicationId && form.value.startTime && form.value.endTime
)

const handleSubmit = () => {
  if (!canSubmit.value) return
  emit('create', {
    specialistId: form.value.specialistId,
    applicationId: form.value.applicationId,
    startTime: form.value.startTime + ':00-05',
    endTime: form.value.endTime + ':00-05',
    inheritsOnReopen: form.value.inheritsOnReopen,
  })
}
</script>

<template>
  <Transition name="panel">
    <div v-if="visible" class="panel-overlay" @click.self="$emit('close')">
      <div class="panel">
        <!-- Header -->
        <div class="panel__header">
          <div class="panel__header-icon">
            <i class='bx bx-calendar-plus'></i>
          </div>
          <div>
            <h2 class="panel__title">Nueva ventana</h2>
            <p v-if="dateLabel" class="panel__date">{{ dateLabel }}</p>
          </div>
          <button @click="$emit('close')" class="panel__close" :disabled="creating">
            <i class='bx bx-x'></i>
          </button>
        </div>

        <!-- Time bar (visual, estilo Teams) -->
        <div class="panel__timebar">
          <div class="timebar__slot">
            <i class='bx bx-time-five'></i>
            <input v-model="form.startTime" type="time" class="timebar__input" :disabled="creating">
          </div>
          <span class="timebar__separator">—</span>
          <div class="timebar__slot">
            <input v-model="form.endTime" type="time" class="timebar__input" :disabled="creating">
          </div>
        </div>

        <!-- Form -->
        <div class="panel__body">
          <div class="panel__field">
            <div class="panel__field-icon"><i class='bx bx-user'></i></div>
            <select v-model="form.specialistId" class="panel__select" :disabled="creating" required>
              <option value="" disabled>Seleccionar especialista...</option>
              <option v-for="s in specialists" :key="s.specialistId" :value="s.specialistId">
                {{ s.fullName }}
              </option>
            </select>
          </div>

          <div class="panel__field">
            <div class="panel__field-icon"><i class='bx bx-cube'></i></div>
            <select v-model="form.applicationId" class="panel__select" :disabled="creating" required>
              <option value="" disabled>Seleccionar aplicación...</option>
              <option v-for="a in applications" :key="a.id" :value="a.id">
                {{ a.name }}
              </option>
            </select>
          </div>

          <label class="panel__checkbox">
            <input type="checkbox" v-model="form.inheritsOnReopen" :disabled="creating">
            <i :class="form.inheritsOnReopen ? 'bx bx-transfer' : 'bx bx-transfer'" class="panel__checkbox-icon"></i>
            <span>Heredar conteo al reabrir</span>
          </label>

          <!-- Error -->
          <div v-if="error" class="panel__error">
            <i class='bx bx-error-circle'></i> {{ error }}
          </div>
        </div>

        <!-- Footer -->
        <div class="panel__footer">
          <button
            class="panel__btn-create"
            :disabled="creating || !canSubmit"
            @click="handleSubmit"
          >
            <i v-if="creating" class='bx bx-loader-alt bx-spin'></i>
            <i v-else class='bx bx-check'></i>
            {{ creating ? 'Creando...' : 'Crear ventana' }}
          </button>
          <button class="panel__btn-cancel" @click="$emit('close')" :disabled="creating">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ---- Overlay ---- */
.panel-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  justify-content: flex-end;
  z-index: 100;
}

/* ---- Panel lateral ---- */
.panel {
  width: 380px;
  max-width: 100%;
  height: 100%;
  background: white;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* ---- Header ---- */
.panel__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.panel__header-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.panel__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.panel__date {
  font-size: 0.78rem;
  color: var(--text-secondary);
  text-transform: capitalize;
  margin-top: 0.05rem;
}

.panel__close {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.4rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
}

.panel__close:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

/* ---- Time bar ---- */
.panel__timebar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-light);
}

.timebar__slot {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
}

.timebar__slot i {
  color: var(--primary-500);
  font-size: 1.15rem;
}

.timebar__input {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.5rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-primary);
  background: white;
  width: 100%;
}

.timebar__input:focus {
  outline: none;
  border-color: var(--primary-500);
}

.timebar__separator {
  color: var(--text-secondary);
  font-weight: 300;
  font-size: 1.1rem;
}

/* ---- Body / Fields ---- */
.panel__body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  flex: 1;
}

.panel__field {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.15rem 0;
}

.panel__field-icon {
  color: var(--text-secondary);
  font-size: 1.15rem;
  width: 1.5rem;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.panel__select {
  flex: 1;
  border: none;
  border-bottom: 1.5px solid var(--border-light);
  padding: 0.5rem 0.25rem;
  font-size: 0.88rem;
  color: var(--text-primary);
  background: transparent;
  border-radius: 0;
  cursor: pointer;
  transition: border-color 0.15s;
  -webkit-appearance: none;
  appearance: none;
}

.panel__select:focus {
  outline: none;
  border-bottom-color: var(--primary-500);
}

.panel__select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---- Checkbox ---- */
.panel__checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem 0;
  margin-top: 0.25rem;
}

.panel__checkbox input {
  display: none;
}

.panel__checkbox-icon {
  font-size: 1.1rem;
  width: 1.5rem;
  display: flex;
  justify-content: center;
  color: var(--text-secondary);
  transition: color 0.15s;
}

.panel__checkbox input:checked ~ .panel__checkbox-icon {
  color: var(--primary-500);
}

.panel__checkbox input:checked ~ span {
  color: var(--text-primary);
  font-weight: 500;
}

/* ---- Error ---- */
.panel__error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.8rem;
  background: var(--error-bg);
  color: var(--error-text);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
}

.panel__error i {
  font-size: 1rem;
}

/* ---- Footer ---- */
.panel__footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--border-light);
}

.panel__btn-create {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.65rem;
  background: var(--primary-500);
  color: white;
  font-weight: 600;
  font-size: 0.88rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}

.panel__btn-create:hover:not(:disabled) {
  background: var(--primary-600);
}

.panel__btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel__btn-cancel {
  background: none;
  border: none;
  padding: 0.5rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: color 0.15s;
}

.panel__btn-cancel:hover {
  color: var(--text-primary);
}

/* ---- Transitions ---- */
.panel-enter-active {
  transition: opacity 0.2s ease;
}
.panel-enter-active .panel {
  animation: slide-in 0.25s ease;
}
.panel-leave-active {
  transition: opacity 0.15s ease;
}
.panel-leave-active .panel {
  animation: slide-out 0.2s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slide-out {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

@media (max-width: 480px) {
  .panel {
    width: 100%;
  }
}
</style>

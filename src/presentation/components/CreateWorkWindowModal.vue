<script setup>
import { ref, watch, computed, nextTick } from 'vue'

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
  scheduledDate: '',
  inheritsOnReopen: false,
})

// ---- Custom dropdown state ----
const specOpen = ref(false)
const specSearch = ref('')
const specInput = ref(null)
const appOpen = ref(false)
const appSearch = ref('')
const appInput = ref(null)

const filteredSpecs = computed(() => {
  const q = specSearch.value.toLowerCase().trim()
  if (!q) return props.specialists
  return props.specialists.filter(s => s.fullName.toLowerCase().includes(q))
})

const filteredApps = computed(() => {
  const q = appSearch.value.toLowerCase().trim()
  if (!q) return props.applications
  return props.applications.filter(a => a.name.toLowerCase().includes(q))
})

const selectedSpecName = computed(() => {
  if (!form.value.specialistId) return ''
  return props.specialists.find(s => s.specialistId === form.value.specialistId)?.fullName || ''
})

const selectedAppName = computed(() => {
  if (!form.value.applicationId) return ''
  return props.applications.find(a => a.id === form.value.applicationId)?.name || ''
})

const toggleSpecDropdown = () => {
  if (props.creating) return
  if (specOpen.value) { specOpen.value = false; return }
  specOpen.value = true
  specSearch.value = ''
  appOpen.value = false
  nextTick(() => specInput.value?.focus())
}

const toggleAppDropdown = () => {
  if (props.creating) return
  if (appOpen.value) { appOpen.value = false; return }
  appOpen.value = true
  appSearch.value = ''
  specOpen.value = false
  nextTick(() => appInput.value?.focus())
}

const selectSpec = (s) => {
  form.value.specialistId = s.specialistId
  specOpen.value = false
}

const selectApp = (a) => {
  form.value.applicationId = a.id
  appOpen.value = false
}

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

watch(() => props.visible, (val) => {
  if (!val) return
  specOpen.value = false
  appOpen.value = false
  if (props.prefill) {
    const sh = String(Math.floor(props.prefill.startHour)).padStart(2, '0')
    const sm = String(Math.round((props.prefill.startHour % 1) * 60)).padStart(2, '0')
    const eh = String(Math.floor(props.prefill.endHour)).padStart(2, '0')
    const em = String(Math.round((props.prefill.endHour % 1) * 60)).padStart(2, '0')
    form.value = {
      specialistId: '',
      applicationId: '',
      startTime: `${sh}:${sm}`,
      endTime: `${eh}:${em}`,
      scheduledDate: props.prefill.date || todayISO(),
      inheritsOnReopen: false,
    }
  } else {
    form.value = {
      specialistId: '',
      applicationId: '',
      startTime: '08:00',
      endTime: '17:00',
      scheduledDate: todayISO(),
      inheritsOnReopen: false,
    }
  }
})

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const dateLabel = computed(() => {
  const iso = form.value.scheduledDate
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
})

const durationLabel = computed(() => {
  const [sh, sm] = (form.value.startTime || '08:00').split(':').map(Number)
  const [eh, em] = (form.value.endTime || '17:00').split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
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
    scheduledDate: form.value.scheduledDate,
    inheritsOnReopen: form.value.inheritsOnReopen,
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="overlay" @click.self="$emit('close')">
        <div class="modal">
          <!-- Header -->
          <div class="modal__header">
            <span class="modal__title">Nueva ventana de trabajo</span>
            <button @click="$emit('close')" class="modal__close" :disabled="creating">
              <i class='bx bx-x'></i>
            </button>
          </div>

          <!-- Body -->
          <div class="modal__body">
            <!-- Date -->
            <div class="row" @click="specOpen = false; appOpen = false">
              <i class='bx bx-calendar'></i>
              <div class="row__content">
                <input v-model="form.scheduledDate" type="date" class="row__date" :disabled="creating">
                <span v-if="dateLabel" class="row__hint">{{ dateLabel }}</span>
              </div>
            </div>

            <!-- Time -->
            <div class="row" @click="specOpen = false; appOpen = false">
              <i class='bx bx-time-five'></i>
              <div class="row__time">
                <input v-model="form.startTime" type="time" class="time-input" :disabled="creating">
                <span class="time-dash">–</span>
                <input v-model="form.endTime" type="time" class="time-input" :disabled="creating">
                <span v-if="durationLabel" class="time-badge">{{ durationLabel }}</span>
              </div>
            </div>

            <!-- Specialist -->
            <div class="row row--picker" @click="toggleSpecDropdown">
              <i class='bx bx-user'></i>
              <span v-if="!specOpen" class="picker__value" :class="{ 'picker__value--placeholder': !selectedSpecName }">
                {{ selectedSpecName || 'Especialista' }}
              </span>
              <input
                v-if="specOpen"
                ref="specInput"
                v-model="specSearch"
                class="picker__search"
                placeholder="Buscar especialista..."
                @click.stop
                @keydown.escape="specOpen = false"
              >
              <i class='bx bx-chevron-down picker__chevron' :class="{ 'picker__chevron--open': specOpen }"></i>
              <Transition name="dropdown">
                <div v-if="specOpen" class="picker__dropdown" @mousedown.prevent>
                  <div
                    v-for="s in filteredSpecs"
                    :key="s.specialistId"
                    class="picker__option"
                    :class="{ 'picker__option--active': s.specialistId === form.specialistId }"
                    @click.stop="selectSpec(s)"
                  >
                    <span class="picker__option-name">{{ s.fullName }}</span>
                  </div>
                  <div v-if="filteredSpecs.length === 0" class="picker__empty">Sin resultados</div>
                </div>
              </Transition>
            </div>

            <!-- Application -->
            <div class="row row--picker" @click="toggleAppDropdown">
              <i class='bx bx-cube'></i>
              <span v-if="!appOpen" class="picker__value" :class="{ 'picker__value--placeholder': !selectedAppName }">
                {{ selectedAppName || 'Aplicación' }}
              </span>
              <input
                v-if="appOpen"
                ref="appInput"
                v-model="appSearch"
                class="picker__search"
                placeholder="Buscar aplicación..."
                @click.stop
                @keydown.escape="appOpen = false"
              >
              <i class='bx bx-chevron-down picker__chevron' :class="{ 'picker__chevron--open': appOpen }"></i>
              <Transition name="dropdown">
                <div v-if="appOpen" class="picker__dropdown" @mousedown.prevent>
                  <div
                    v-for="a in filteredApps"
                    :key="a.id"
                    class="picker__option"
                    :class="{ 'picker__option--active': a.id === form.applicationId }"
                    @click.stop="selectApp(a)"
                  >
                    <span class="picker__option-name">{{ a.name }}</span>
                  </div>
                  <div v-if="filteredApps.length === 0" class="picker__empty">Sin resultados</div>
                </div>
              </Transition>
            </div>

            <!-- Inherit toggle -->
            <label class="row row--toggle" @click.prevent="specOpen = false; appOpen = false; form.inheritsOnReopen = !form.inheritsOnReopen">
              <i class='bx bx-transfer' :class="{ 'icon--active': form.inheritsOnReopen }"></i>
              <span class="row__label" :class="{ 'row__label--active': form.inheritsOnReopen }">Heredar conteo al reabrir</span>
              <div class="switch" :class="{ 'switch--on': form.inheritsOnReopen }">
                <div class="switch__knob"></div>
              </div>
            </label>

            <!-- Error -->
            <div v-if="error" class="modal__error">
              <i class='bx bx-error-circle'></i> {{ error }}
            </div>
          </div>

          <!-- Footer -->
          <div class="modal__footer">
            <button class="btn-cancel" @click="$emit('close')" :disabled="creating">Cancelar</button>
            <button class="btn-save" :disabled="creating || !canSubmit" @click="handleSubmit">
              <i v-if="creating" class='bx bx-loader-alt bx-spin'></i>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: white;
  width: 100%;
  max-width: 420px;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

/* ---- Header ---- */
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.4rem;
  border-bottom: 1px solid var(--border-light);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: white;
}

.modal__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.modal__close {
  background: none;
  border: none;
  font-size: 1.3rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: 0.15rem;
  transition: color 0.12s;
}

.modal__close:hover { color: var(--text-primary); }

/* ---- Body ---- */
.modal__body {
  padding: 0.5rem 0;
}

/* ---- Row ---- */
.row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 1.4rem;
  transition: background 0.1s;
}

.row:hover { background: var(--bg-card); }

.row > i {
  font-size: 1.05rem;
  color: var(--text-secondary);
  width: 1.2rem;
  flex-shrink: 0;
  text-align: center;
}

.icon--active { color: var(--primary-500); }

/* Date row */
.row__content {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.row__date {
  border: none;
  background: none;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  padding: 0;
  cursor: pointer;
  outline: none;
}

.row__hint {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: capitalize;
}

/* Time row */
.row__time {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
}

.time-input {
  border: none;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.45rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  width: 5.2rem;
  outline: none;
  transition: box-shadow 0.12s;
}

.time-input:focus {
  box-shadow: 0 0 0 2px rgba(42, 199, 143, 0.2);
}

.time-dash {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.time-badge {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--primary-500);
  background: rgba(42, 199, 143, 0.08);
  padding: 0.12rem 0.4rem;
  border-radius: var(--radius-full);
  margin-left: auto;
}

/* Picker (custom dropdown) */
.row--picker {
  position: relative;
  cursor: pointer;
}

.picker__value {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.picker__value--placeholder {
  color: var(--text-secondary);
  font-weight: 500;
}

.picker__search {
  flex: 1;
  border: none;
  background: none;
  font-size: 0.85rem;
  color: var(--text-primary);
  outline: none;
  padding: 0;
}

.picker__chevron {
  font-size: 1rem;
  color: var(--text-secondary);
  transition: transform 0.15s;
}

.picker__chevron--open {
  transform: rotate(180deg);
}

.picker__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 1.4rem;
  right: 1.4rem;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  max-height: 180px;
  overflow-y: auto;
  z-index: 50;
  padding: 0.25rem;
}

.picker__option {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s;
}

.picker__option:hover {
  background: var(--bg-card);
}

.picker__option--active {
  background: rgba(42, 199, 143, 0.08);
}

.picker__option--active .picker__option-name {
  color: var(--primary-600);
  font-weight: 600;
}

.picker__option-name {
  font-size: 0.82rem;
  color: var(--text-primary);
}

.picker__empty {
  padding: 0.6rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  text-align: center;
}

/* Dropdown transition */
.dropdown-enter-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.dropdown-leave-active { transition: opacity 0.08s ease; }
.dropdown-enter-from { opacity: 0; transform: translateY(-4px); }
.dropdown-leave-to { opacity: 0; }

/* Toggle row */
.row--toggle { cursor: pointer; }

.row__label {
  flex: 1;
  font-size: 0.82rem;
  color: var(--text-secondary);
  transition: color 0.15s;
}

.row__label--active { color: var(--text-primary); }

.switch {
  width: 1.85rem;
  height: 1.05rem;
  border-radius: var(--radius-full);
  background: var(--border-light);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.switch--on { background: var(--primary-500); }

.switch__knob {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: white;
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.switch--on .switch__knob { transform: translateX(0.8rem); }

/* ---- Error ---- */
.modal__error {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.5rem 1.4rem;
  padding: 0.5rem 0.7rem;
  background: var(--error-bg);
  color: var(--error-text);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
}

.modal__error i { font-size: 0.95rem; }

/* ---- Footer ---- */
.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.4rem;
  border-top: 1px solid var(--border-light);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: white;
}

.btn-cancel {
  padding: 0.45rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  background: white;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: color 0.12s;
}

.btn-cancel:hover { color: var(--text-primary); }

.btn-save {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 1rem;
  background: var(--primary-500);
  color: white;
  font-weight: 600;
  font-size: 0.82rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-save:hover:not(:disabled) { background: var(--primary-600); }
.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

/* ---- Transition ---- */
.modal-enter-active { transition: opacity 0.15s ease; }
.modal-enter-active .modal { animation: pop-in 0.2s ease; }
.modal-leave-active { transition: opacity 0.12s ease; }
.modal-leave-to { opacity: 0; }

@keyframes pop-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@media (max-width: 480px) {
  .modal { max-width: calc(100% - 2rem); }
}
</style>

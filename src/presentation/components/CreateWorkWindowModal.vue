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

// ---- Form state ----
const startTime = ref('08:00')
const endTime = ref('17:00')
const endDate = ref('')
const selectedDates = ref([])
const inheritsOnReopen = ref(false)

// Rows: each row is { specialistId, applicationId }
const rows = ref([{ specialistId: '', applicationId: '' }])

const addRow = () => {
  rows.value.push({ specialistId: '', applicationId: '' })
}

const removeRow = (i) => {
  if (rows.value.length > 1) rows.value.splice(i, 1)
}

// ---- Dropdowns ----
const activeDropdown = ref(null) // 'spec-0', 'app-1', etc.
const dropdownSearch = ref('')
const searchInput = ref(null)

const openDropdown = (key) => {
  if (props.creating) return
  if (activeDropdown.value === key) { activeDropdown.value = null; return }
  activeDropdown.value = key
  dropdownSearch.value = ''
  nextTick(() => {
    const el = Array.isArray(searchInput.value) ? searchInput.value[0] : searchInput.value
    el?.focus()
  })
}

const closeDropdowns = () => { activeDropdown.value = null }

const filteredSpecs = computed(() => {
  const q = dropdownSearch.value.toLowerCase().trim()
  if (!q) return props.specialists
  return props.specialists.filter(s => s.fullName.toLowerCase().includes(q))
})

const filteredApps = computed(() => {
  const q = dropdownSearch.value.toLowerCase().trim()
  if (!q) return props.applications
  return props.applications.filter(a => a.name.toLowerCase().includes(q))
})

const specName = (id) => props.specialists.find(s => s.specialistId === id)?.fullName || ''
const appName = (id) => props.applications.find(a => a.id === id)?.name || ''

const selectSpec = (rowIdx, s) => {
  rows.value[rowIdx].specialistId = s.specialistId
  activeDropdown.value = null
}

const selectApp = (rowIdx, a) => {
  rows.value[rowIdx].applicationId = a.id
  activeDropdown.value = null
}

// ---- Date helpers ----
const DAY_NAMES_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isMultiDay = computed(() => selectedDates.value.length > 1)

const onStartDateChange = (val) => {
  if (isPastDate(val)) return
  const oldStart = selectedDates.value[0]
  selectedDates.value = [val]
  // If endDate was same as old start or before new start, sync it
  if (!endDate.value || endDate.value === oldStart || endDate.value < val) {
    endDate.value = val
  }
}

const formatDateChip = (iso) => {
  const d = new Date(iso + 'T12:00:00')
  return `${DAY_NAMES_SHORT[d.getDay()]} ${d.getDate()}`
}

const formatDateFull = (iso) => {
  const d = new Date(iso + 'T12:00:00')
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

const removeDate = (iso) => {
  if (selectedDates.value.length <= 1) return
  selectedDates.value = selectedDates.value.filter(d => d !== iso)
}

// ---- Time display ----
const durationLabel = computed(() => {
  const [sh, sm] = (startTime.value || '08:00').split(':').map(Number)
  const [eh, em] = (endTime.value || '17:00').split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
})

// ---- Conflict detection ----
const conflicts = computed(() => {
  const seen = new Map()
  const warns = []
  for (let i = 0; i < rows.value.length; i++) {
    const r = rows.value[i]
    if (!r.specialistId) continue
    const key = r.specialistId
    if (seen.has(key)) {
      const prevIdx = seen.get(key)
      const name = specName(r.specialistId)
      warns.push(`${name} aparece en la fila ${prevIdx + 1} y ${i + 1} con diferente aplicación en el mismo horario.`)
    } else {
      seen.set(key, i)
    }
  }
  return warns
})

// ---- Total count ----
const totalWindows = computed(() => {
  const validRows = rows.value.filter(r => r.specialistId && r.applicationId).length
  return selectedDates.value.length * validRows
})

// ---- Date/time validation ----
const isPastDate = (iso) => iso < todayISO()

const endTimeError = computed(() => {
  if (!selectedDates.value.includes(todayISO())) return null
  if (!endTime.value) return null
  const [endH, endM] = endTime.value.split(':').map(Number)
  const endMinutes = endH * 60 + endM
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (endMinutes < nowMinutes + 30) {
    return 'La hora de fin debe ser al menos 30 min posterior a la hora actual para hoy.'
  }
  return null
})

const hasCompleteRow = computed(() => rows.value.some(r => r.specialistId && r.applicationId))

watch(hasCompleteRow, (v) => { if (!v) inheritsOnReopen.value = false })

// ---- Validation ----
const canSubmit = computed(() => {
  if (selectedDates.value.length === 0) return false
  if (!startTime.value || !endTime.value) return false
  if (endTimeError.value) return false
  return rows.value.some(r => r.specialistId && r.applicationId)
})

// ---- Init on open ----
watch(() => props.visible, (val) => {
  if (!val) return
  activeDropdown.value = null
  if (props.prefill) {
    const sh = String(Math.floor(props.prefill.startHour)).padStart(2, '0')
    const sm = String(Math.round((props.prefill.startHour % 1) * 60)).padStart(2, '0')
    const eh = String(Math.floor(props.prefill.endHour)).padStart(2, '0')
    const em = String(Math.round((props.prefill.endHour % 1) * 60)).padStart(2, '0')
    startTime.value = `${sh}:${sm}`
    endTime.value = `${eh}:${em}`
    if (props.prefill.days && props.prefill.days.length > 0) {
      selectedDates.value = props.prefill.days.map(d => d.date)
      endDate.value = selectedDates.value[selectedDates.value.length - 1]
    } else if (props.prefill.dates && props.prefill.dates.length > 0) {
      selectedDates.value = props.prefill.dates
      endDate.value = props.prefill.dates[props.prefill.dates.length - 1]
    } else {
      selectedDates.value = [props.prefill.date || todayISO()]
      endDate.value = selectedDates.value[0]
    }
    if (props.prefill.startTime) startTime.value = props.prefill.startTime
    if (props.prefill.endTime) endTime.value = props.prefill.endTime
  } else {
    startTime.value = '08:00'
    endTime.value = '17:00'
    selectedDates.value = [todayISO()]
    endDate.value = todayISO()
  }
  rows.value = [{ specialistId: '', applicationId: '' }]
  inheritsOnReopen.value = false
})

// ---- Submit ----
const handleSubmit = () => {
  if (!canSubmit.value) return
  const validRows = rows.value.filter(r => r.specialistId && r.applicationId)
  const windows = []
  const useEndDate = !isMultiDay.value && endDate.value && endDate.value !== selectedDates.value[0]
  for (const date of selectedDates.value) {
    for (const row of validRows) {
      windows.push({
        specialistId: row.specialistId,
        applicationId: row.applicationId,
        startTime: startTime.value,
        endTime: endTime.value,
        scheduledDate: date,
        ...(useEndDate ? { endDate: endDate.value } : {}),
        inheritsOnReopen: inheritsOnReopen.value,
      })
    }
  }
  emit('create', windows)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="overlay" @click.self="$emit('close')">
        <div class="modal" @click="closeDropdowns">
          <!-- Header -->
          <div class="modal__header">
            <span class="modal__title">Nueva ventana de trabajo</span>
            <button @click="$emit('close')" class="modal__close" :disabled="creating">
              <i class='bx bx-x'></i>
            </button>
          </div>

          <!-- Body -->
          <div class="modal__body">
            <!-- Multi-day chips -->
            <div v-if="isMultiDay" class="row" @click.stop="closeDropdowns">
              <i class='bx bx-calendar'></i>
              <div class="chips">
                <span v-for="date in selectedDates" :key="date" class="chip">
                  {{ formatDateChip(date) }}
                  <button class="chip__remove" @click="removeDate(date)" :disabled="creating">
                    <i class='bx bx-x'></i>
                  </button>
                </span>
              </div>
            </div>
            <div v-if="isMultiDay" class="row" @click.stop="closeDropdowns">
              <i class='bx bx-time-five'></i>
              <div class="row__time">
                <input v-model="startTime" type="time" class="time-input" :disabled="creating">
                <span class="time-dash">–</span>
                <input v-model="endTime" type="time" class="time-input" :disabled="creating">
                <span v-if="durationLabel" class="time-badge">{{ durationLabel }}</span>
              </div>
              <span v-if="endTimeError" class="row__error">{{ endTimeError }}</span>
            </div>

            <!-- Single/range: Google Calendar style (date+time start, date+time end) -->
            <template v-if="!isMultiDay">
              <div class="row" @click.stop="closeDropdowns">
                <i class='bx bx-calendar'></i>
                <div class="row__datetime">
                  <label class="row__datetime-label">Inicio</label>
                  <div class="row__datetime-inputs">
                    <input
                      :value="selectedDates[0]"
                      @input="onStartDateChange($event.target.value)"
                      type="date"
                      :min="todayISO()"
                      class="row__date"
                      :disabled="creating"
                    >
                    <input v-model="startTime" type="time" class="time-input" :disabled="creating">
                  </div>
                </div>
              </div>
              <div class="row" @click.stop="closeDropdowns">
                <i class='bx bx-calendar-check'></i>
                <div class="row__datetime">
                  <label class="row__datetime-label">Fin</label>
                  <div class="row__datetime-inputs">
                    <input
                      v-model="endDate"
                      type="date"
                      :min="selectedDates[0] || todayISO()"
                      class="row__date"
                      :disabled="creating"
                    >
                    <input v-model="endTime" type="time" class="time-input" :disabled="creating">
                    <span v-if="durationLabel" class="time-badge">{{ durationLabel }}</span>
                  </div>
                </div>
                <span v-if="endTimeError" class="row__error">{{ endTimeError }}</span>
              </div>
            </template>

            <!-- Separator -->
            <div class="section-label">Personas</div>

            <!-- Specialist+App rows -->
            <div v-for="(row, i) in rows" :key="i" class="person-row">
              <!-- Specialist picker -->
              <div class="mini-picker" @click.stop="openDropdown(`spec-${i}`)">
                <i class='bx bx-user'></i>
                <span v-if="activeDropdown !== `spec-${i}`" class="mini-picker__value" :class="{ 'mini-picker__value--placeholder': !row.specialistId }">
                  {{ specName(row.specialistId) || 'Especialista' }}
                </span>
                <input
                  v-if="activeDropdown === `spec-${i}`"
                  ref="searchInput"
                  v-model="dropdownSearch"
                  class="mini-picker__search"
                  placeholder="Buscar..."
                  @click.stop
                  @keydown.escape="closeDropdowns"
                >
                <Transition name="dropdown">
                  <div v-if="activeDropdown === `spec-${i}`" class="mini-picker__dropdown" @mousedown.prevent>
                    <div
                      v-for="s in filteredSpecs"
                      :key="s.specialistId"
                      class="mini-picker__option"
                      :class="{ 'mini-picker__option--active': s.specialistId === row.specialistId }"
                      @click.stop="selectSpec(i, s)"
                    >{{ s.fullName }}</div>
                    <div v-if="filteredSpecs.length === 0" class="mini-picker__empty">Sin resultados</div>
                  </div>
                </Transition>
              </div>

              <!-- App picker -->
              <div class="mini-picker" @click.stop="openDropdown(`app-${i}`)">
                <i class='bx bx-cube'></i>
                <span v-if="activeDropdown !== `app-${i}`" class="mini-picker__value" :class="{ 'mini-picker__value--placeholder': !row.applicationId }">
                  {{ appName(row.applicationId) || 'Aplicación' }}
                </span>
                <input
                  v-if="activeDropdown === `app-${i}`"
                  ref="searchInput"
                  v-model="dropdownSearch"
                  class="mini-picker__search"
                  placeholder="Buscar..."
                  @click.stop
                  @keydown.escape="closeDropdowns"
                >
                <Transition name="dropdown">
                  <div v-if="activeDropdown === `app-${i}`" class="mini-picker__dropdown" @mousedown.prevent>
                    <div
                      v-for="a in filteredApps"
                      :key="a.id"
                      class="mini-picker__option"
                      :class="{ 'mini-picker__option--active': a.id === row.applicationId }"
                      @click.stop="selectApp(i, a)"
                    >{{ a.name }}</div>
                    <div v-if="filteredApps.length === 0" class="mini-picker__empty">Sin resultados</div>
                  </div>
                </Transition>
              </div>

              <!-- Remove row -->
              <button v-if="rows.length > 1" class="person-row__remove" @click="removeRow(i)" :disabled="creating">
                <i class='bx bx-x'></i>
              </button>
            </div>

            <!-- Add person -->
            <button class="btn-add-person" @click="addRow" :disabled="creating">
              <i class='bx bx-plus'></i> Agregar persona
            </button>

            <!-- Conflicts -->
            <div v-for="(warn, i) in conflicts" :key="i" class="modal__warn">
              <i class='bx bx-error'></i> {{ warn }}
            </div>

            <!-- Inherit toggle -->
            <label
              class="row row--toggle"
              :class="{ 'row--disabled': !hasCompleteRow }"
              @click.prevent="if (hasCompleteRow) { closeDropdowns(); inheritsOnReopen = !inheritsOnReopen }"
            >
              <i class='bx bx-transfer' :class="{ 'icon--active': inheritsOnReopen }"></i>
              <span class="row__label" :class="{ 'row__label--active': inheritsOnReopen }">Heredar de ventana anterior</span>
              <div class="switch" :class="{ 'switch--on': inheritsOnReopen }">
                <div class="switch__knob"></div>
              </div>
            </label>
            <p v-if="inheritsOnReopen" class="modal__hint">
              Al abrir esta ventana, se heredará el conteo de la última ventana cerrada del mismo especialista y aplicación.
            </p>

            <!-- Error -->
            <div v-if="error" class="modal__error">
              <i class='bx bx-error-circle'></i> {{ error }}
            </div>
          </div>

          <!-- Footer -->
          <div class="modal__footer">
            <span v-if="totalWindows > 1" class="modal__count">Se crearán {{ totalWindows }} ventanas</span>
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
  max-width: 480px;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

/* ---- Header ---- */
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.4rem;
  border-bottom: 1px solid var(--border-light);
  background: white;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  flex-shrink: 0;
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
  overflow-y: auto;
  flex: 1;
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
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: none;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-primary);
  padding: 0.3rem 0.4rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}
.row__date:focus { border-color: var(--primary-500); }

.row__hint {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: capitalize;
}

/* DateTime row (Google Calendar style) */
.row__datetime {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.row__datetime-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.row__datetime-inputs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.row__error {
  font-size: 0.7rem;
  color: #ef4444;
  margin-top: 0.2rem;
}

/* Chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  flex: 1;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  background: rgba(42, 199, 143, 0.08);
  color: var(--primary-600);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.chip__remove {
  background: none;
  border: none;
  color: var(--primary-500);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  opacity: 0.6;
  transition: opacity 0.12s;
}

.chip__remove:hover { opacity: 1; }

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

/* Section label */
.section-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  padding: 0.6rem 1.4rem 0.2rem;
}

/* Person row */
.person-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 1.4rem;
}

.person-row__remove {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.15rem;
  border-radius: var(--radius-sm);
  transition: color 0.12s;
  flex-shrink: 0;
}

.person-row__remove:hover { color: var(--error-500); }

/* Mini picker */
.mini-picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.12s;
}

.mini-picker:hover { border-color: var(--primary-400); }

.mini-picker > i {
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.mini-picker__value {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.mini-picker__value--placeholder {
  color: var(--text-secondary);
  font-weight: 500;
}

.mini-picker__search {
  flex: 1;
  border: none;
  background: none;
  font-size: 0.78rem;
  color: var(--text-primary);
  outline: none;
  padding: 0;
  min-width: 0;
}

.mini-picker__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  max-height: 160px;
  overflow-y: auto;
  z-index: 50;
  padding: 0.2rem;
}

.mini-picker__option {
  padding: 0.4rem 0.5rem;
  font-size: 0.78rem;
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-picker__option:hover { background: var(--bg-card); }
.mini-picker__option--active { background: rgba(42, 199, 143, 0.08); color: var(--primary-600); font-weight: 600; }

.mini-picker__empty {
  padding: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

/* Add person btn */
.btn-add-person {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.25rem 1.4rem;
  padding: 0.35rem 0.6rem;
  background: none;
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}

.btn-add-person:hover {
  color: var(--primary-500);
  border-color: var(--primary-400);
}

.btn-add-person:disabled { opacity: 0.4; cursor: not-allowed; }

/* Warnings */
.modal__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.3rem 1.4rem;
  padding: 0.4rem 0.6rem;
  background: #FFF7ED;
  color: #C2410C;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  font-weight: 600;
}

.modal__warn i { font-size: 0.9rem; }

/* Toggle row */
.row--toggle { cursor: pointer; }
.row--disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }

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

/* ---- Hint ---- */
.modal__hint {
  margin: -0.2rem 1.4rem 0.3rem 2.8rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

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
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.4rem;
  border-top: 1px solid var(--border-light);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: white;
  flex-shrink: 0;
}

.modal__count {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--primary-500);
  margin-right: auto;
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

/* Dropdown transition */
.dropdown-enter-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.dropdown-leave-active { transition: opacity 0.08s ease; }
.dropdown-enter-from { opacity: 0; transform: translateY(-4px); }
.dropdown-leave-to { opacity: 0; }

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
  .person-row { flex-wrap: wrap; }
  .mini-picker { min-width: calc(50% - 1rem); }
}
</style>

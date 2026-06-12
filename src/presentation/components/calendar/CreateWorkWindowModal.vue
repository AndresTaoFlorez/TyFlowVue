<script setup>
import '@/styles/components/calendar/cal-modal.css'
import { ref, watch, computed, nextTick } from 'vue'
import { fmtDateISO } from '@/presentation/helpers/formatDate'

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
// Estilo Google Calendar: SIEMPRE inicio (fecha+hora) → fin (fecha+hora).
// Una sola ventana por persona, que puede cruzar días. La repetición por
// varios días vive en el módulo de recurrencia, no aquí.
const startDate = ref('')
const startTime = ref('08:00')
const endDate = ref('')
const endTime = ref('17:00')
const inheritsOnReopen = ref(false)
const affinityWeight = ref('1')

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

const specsWithApps = computed(() =>
  props.specialists.filter(s => s.applicationAssignments?.length > 0)
)

const filteredSpecs = computed(() => {
  const q = dropdownSearch.value.toLowerCase().trim()
  if (!q) return specsWithApps.value
  return specsWithApps.value.filter(s => s.fullName.toLowerCase().includes(q))
})

const appsForRow = (rowIdx) => {
  const row = rows.value[rowIdx]
  if (!row?.specialistId) return props.applications
  const spec = props.specialists.find(s => s.specialistId === row.specialistId)
  if (!spec?.applicationAssignments?.length) return []  // no assignments → no valid apps
  const allowedIds = new Set(spec.applicationAssignments.map(a => a.application_id || a.id || a))
  return props.applications.filter(a => allowedIds.has(a.id))
}

const filteredApps = computed(() => {
  const q = dropdownSearch.value.toLowerCase().trim()
  // Find which row's app dropdown is open
  const match = activeDropdown.value?.match(/^app-(\d+)$/)
  const rowIdx = match ? parseInt(match[1]) : -1
  const base = rowIdx >= 0 ? appsForRow(rowIdx) : props.applications
  if (!q) return base
  return base.filter(a => a.name.toLowerCase().includes(q))
})

const specName = (id) => props.specialists.find(s => s.specialistId === id)?.fullName || ''
const appName = (id) => props.applications.find(a => a.id === id)?.name || ''

const selectSpec = (rowIdx, s) => {
  rows.value[rowIdx].specialistId = s.specialistId
  // Clear app if not in this specialist's allowed list
  const allowed = appsForRow(rowIdx)
  if (rows.value[rowIdx].applicationId && !allowed.some(a => a.id === rows.value[rowIdx].applicationId)) {
    rows.value[rowIdx].applicationId = ''
  }
  activeDropdown.value = null
}

const selectApp = (rowIdx, a) => {
  rows.value[rowIdx].applicationId = a.id
  activeDropdown.value = null
}

// ---- Date helpers ----
const todayISO = () => fmtDateISO(new Date())

const onStartDateChange = (val) => {
  if (!val || isPastDate(val)) return
  const oldStart = startDate.value
  startDate.value = val
  // Si el fin quedó igual al inicio anterior o antes del nuevo inicio, sincronizarlo
  if (!endDate.value || endDate.value === oldStart || endDate.value < val) {
    endDate.value = val
  }
}

// ---- Time display ----

// Duración real entre (startDate, startTime) y (endDate, endTime) — puede cruzar días.
const durationLabel = computed(() => {
  if (!startDate.value || !endDate.value) return ''
  const start = new Date(`${startDate.value}T${startTime.value || '00:00'}:00`)
  const end = new Date(`${endDate.value}T${endTime.value || '00:00'}:00`)
  const mins = Math.round((end.getTime() - start.getTime()) / 60000)
  if (isNaN(mins) || mins <= 0) return ''
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const parts = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  return parts.join(' ') || ''
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
const totalWindows = computed(() =>
  rows.value.filter(r => r.specialistId && r.applicationId).length
)

// ---- Date/time validation ----
const isPastDate = (iso) => iso < todayISO()

const endTimeError = computed(() => {
  // Si el fin cae en un día futuro, no aplica la regla de "hoy"
  if (endDate.value && endDate.value > todayISO()) return null
  if (endDate.value !== todayISO()) return null
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

const timeOrderError = computed(() => {
  if (!startTime.value || !endTime.value) return null
  // Si el fin es un día calendario posterior, el rango es válido sin comparar
  // horas (p.ej. 22:00 → 02:00 del día siguiente).
  if (endDate.value && endDate.value > (startDate.value ?? '')) return null
  const [sh, sm] = startTime.value.split(':').map(Number)
  const [eh, em] = endTime.value.split(':').map(Number)
  if (sh * 60 + sm >= eh * 60 + em) return 'La hora de inicio debe ser anterior a la de fin.'
  return null
})

const affinityWeightError = computed(() => {
  const v = affinityWeight.value
  if (v === '' || v == null) return 'El peso de afinidad es requerido.'
  const n = parseFloat(v)
  if (isNaN(n)) return 'Ingresa un número válido.'
  if (n < 0.01) return 'El peso mínimo es 0.01.'
  if (n > 9.99) return 'El peso máximo es 9.99.'
  return null
})

// ---- Validation ----
const canSubmit = computed(() => {
  if (!startDate.value || !endDate.value) return false
  if (endDate.value < startDate.value) return false
  if (!startTime.value || !endTime.value) return false
  if (timeOrderError.value) return false
  if (endTimeError.value) return false
  if (affinityWeightError.value) return false
  return rows.value.some(r => r.specialistId && r.applicationId)
})

// ---- Init on open ----
watch(() => props.visible, (val) => {
  if (!val) return
  activeDropdown.value = null
  if (props.prefill) {
    if (props.prefill.startHour != null) {
      const sh = String(Math.floor(props.prefill.startHour)).padStart(2, '0')
      const sm = String(Math.round((props.prefill.startHour % 1) * 60)).padStart(2, '0')
      const eh = String(Math.floor(props.prefill.endHour)).padStart(2, '0')
      const em = String(Math.round((props.prefill.endHour % 1) * 60)).padStart(2, '0')
      startTime.value = `${sh}:${sm}`
      endTime.value = `${eh}:${em}`
    }
    // Estilo Google Calendar: una selección de varios días se traduce a UNA
    // ventana del primer al último día (la repetición es del módulo recurrente).
    const days = props.prefill.days?.map(d => d.date)
      ?? props.prefill.dates
      ?? [props.prefill.date || todayISO()]
    startDate.value = days[0]
    endDate.value = days[days.length - 1]
    if (props.prefill.startTime) startTime.value = props.prefill.startTime
    if (props.prefill.endTime) endTime.value = props.prefill.endTime
  } else {
    startTime.value = '08:00'
    endTime.value = '17:00'
    startDate.value = todayISO()
    endDate.value = todayISO()
  }
  // Auto-fix: if same-day and endTime <= startTime, advance endTime by 1h
  _fixEndTime()
  rows.value = [{ specialistId: '', applicationId: props.prefill?.applicationId || '' }]
  inheritsOnReopen.value = false
  affinityWeight.value = '1'
})

/** Advance endTime to startTime + 1h when they'd be on the same day and out of order. */
function _fixEndTime() {
  if (!startTime.value || !endTime.value) return
  const sameDayMode = !endDate.value || endDate.value <= (startDate.value ?? '')
  if (!sameDayMode) return
  const [sh, sm] = startTime.value.split(':').map(Number)
  const [eh, em] = endTime.value.split(':').map(Number)
  if (sh * 60 + sm >= eh * 60 + em) {
    const newEndM = (sh * 60 + sm + 60) % (24 * 60)
    endTime.value = `${String(Math.floor(newEndM / 60)).padStart(2, '0')}:${String(newEndM % 60).padStart(2, '0')}`
  }
}

// ---- Submit ----
const handleSubmit = () => {
  if (!canSubmit.value) return
  const validRows = rows.value.filter(r => r.specialistId && r.applicationId)
  const useEndDate = endDate.value && endDate.value !== startDate.value
  const windows = validRows.map(row => ({
    specialistId: row.specialistId,
    applicationId: row.applicationId,
    startTime: startTime.value,
    endTime: endTime.value,
    scheduledDate: startDate.value,
    ...(useEndDate ? { endDate: endDate.value } : {}),
    inheritsOnReopen: inheritsOnReopen.value,
    affinityWeight: parseFloat(affinityWeight.value),
  }))
  emit('create', windows)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="overlay" @click.self="$emit('close')">
        <div class="modal" @click="closeDropdowns">
          <div class="modal__top"></div>
          <!-- Header -->
          <div class="modal__head">
            <div>
              <div class="modal__title">Nueva ventana de trabajo</div>
              <div class="modal__sub">Disponibilidad de uno o varios especialistas</div>
            </div>
            <button @click="$emit('close')" class="modal__x" :disabled="creating">&times;</button>
          </div>

          <!-- Body -->
          <div class="modal__body">
            <!-- Google Calendar style: inicio (fecha+hora) → fin (fecha+hora) -->
            <div class="row" @click.stop="closeDropdowns">
              <i class='bx bx-calendar'></i>
              <div class="row__datetime">
                <label class="row__datetime-label">Inicio</label>
                <div class="row__datetime-inputs">
                  <input
                    :value="startDate"
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
                    :min="startDate || todayISO()"
                    class="row__date"
                    :disabled="creating"
                  >
                  <input v-model="endTime" type="time" class="time-input" :disabled="creating">
                  <span v-if="durationLabel" class="time-badge">{{ durationLabel }}</span>
                </div>
              </div>
            </div>
            <div v-if="timeOrderError || endTimeError" class="row__error-row">
              <span class="row__error">{{ timeOrderError || endTimeError }}</span>
            </div>

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

            <!-- Peso de afinidad -->
            <div class="row" @click.stop="closeDropdowns">
              <i class='bx bx-slider-alt'></i>
              <div class="row__datetime">
                <label class="row__datetime-label">Peso de afinidad</label>
                <input
                  v-model="affinityWeight"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="9.99"
                  class="weight-input"
                  :class="{ 'weight-input--error': affinityWeightError }"
                  placeholder="1"
                  :disabled="creating"
                >
              </div>
              <span v-if="affinityWeightError" class="row__error">{{ affinityWeightError }}</span>
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
          <div class="modal__foot cwm__foot">
            <span v-if="totalWindows > 1" class="cwm__count">Se crearán {{ totalWindows }} ventanas</span>
            <button class="mbtn" @click="$emit('close')" :disabled="creating">Cancelar</button>
            <button class="mbtn mbtn--primary" :disabled="creating || !canSubmit" @click="handleSubmit">
              <i v-if="creating" class='bx bx-loader-alt bx-spin'></i>
              Crear
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
  background: rgba(10, 12, 20, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

/* El shell base (.modal/__top/__head/__x) viene de cal-modal.css;
   aquí solo las desviaciones de este modal. */
.modal {
  max-width: 480px;
  max-height: 90vh;
}

/* ---- Body ---- */
/* Las filas (.row) llevan su propio padding lateral; sin gap del shell. */
.modal__body {
  padding: 0.5rem 0 1rem;
  overflow-y: auto;
  flex: 1;
  gap: 0;
}

/* ---- Row ---- */
.row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 1.4rem;
  transition: background 0.1s;
}

.row:hover { background: var(--surface-2); }

.row > i {
  font-size: 1.05rem;
  color: var(--muted);
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
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-2);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text);
  padding: 0 0.7rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}
.row__date:focus { border-color: var(--primary-500); }

.row__hint {
  font-size: 0.7rem;
  color: var(--muted);
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
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.row__datetime-inputs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.row__error-row {
  padding: 0 1.4rem 0 3.2rem;
}
.row__error {
  font-size: 0.7rem;
  color: #ef4444;
}

.time-input {
  height: 38px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 9px;
  padding: 0 0.7rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  width: 7.5rem;
  outline: none;
  transition: border-color 0.15s;
}

.time-input:focus {
  border-color: var(--primary-500);
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

.weight-input {
  height: 38px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 9px;
  padding: 0 0.7rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  width: 8rem;
  outline: none;
  transition: border-color 0.15s;
}

.weight-input:focus {
  border-color: var(--primary-500);
}

.weight-input--error {
  border-color: var(--error-500, #ef4444);
}
.weight-input--error:focus {
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}
.weight-input::placeholder { color: #94a3b8; font-weight: 500; }

/* Section label */
.section-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
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
  color: var(--muted);
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
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.12s;
}

.mini-picker:hover { border-color: var(--border-strong); }

.mini-picker > i {
  font-size: 0.85rem;
  color: var(--muted);
  flex-shrink: 0;
}

.mini-picker__value {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.mini-picker__value--placeholder {
  color: var(--muted);
  font-weight: 500;
}

.mini-picker__search {
  flex: 1;
  border: none;
  background: none;
  font-size: 0.78rem;
  color: var(--text);
  outline: none;
  padding: 0;
  min-width: 0;
}

.mini-picker__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
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
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-picker__option:hover { background: var(--surface-2); }
.mini-picker__option--active { background: rgba(42, 199, 143, 0.08); color: var(--primary-600); font-weight: 600; }

.mini-picker__empty {
  padding: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
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
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}

.btn-add-person:hover {
  color: var(--primary-500);
  border-color: var(--border-strong);
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
  color: var(--muted);
  transition: color 0.15s;
}

.row__label--active { color: var(--text); }

.switch {
  width: 1.85rem;
  height: 1.05rem;
  border-radius: var(--radius-full);
  background: var(--border);
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
  color: var(--muted);
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
.cwm__foot {
  align-items: center;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-soft);
}

.cwm__foot .mbtn {
  flex: 0 0 auto;
  padding: 0 1.1rem;
}

.cwm__count {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--primary-500);
  margin-right: auto;
}

/* Dropdown transition */
.dropdown-enter-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.dropdown-leave-active { transition: opacity 0.08s ease; }
.dropdown-enter-from { opacity: 0; transform: translateY(-4px); }
.dropdown-leave-to { opacity: 0; }

/* ---- Transition ---- (una sola animación de entrada, vía clases del
   <Transition>; sin animaciones siempre-activas que se re-disparen → sin parpadeo) */
.modal-enter-active { transition: opacity 0.18s ease; }
.modal-enter-active .modal { animation: pop-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-leave-active .modal { animation: pop-out 0.15s ease forwards; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@keyframes pop-in {
  from { transform: scale(0.93) translateY(6px); opacity: 0; }
  to   { transform: scale(1)    translateY(0);   opacity: 1; }
}
@keyframes pop-out {
  from { transform: scale(1)    translateY(0);   opacity: 1; }
  to   { transform: scale(0.93) translateY(6px); opacity: 0; }
}

/* Móvil: crear a pantalla completa (subruta estilo Google Calendar). */
@media (max-width: 480px) {
  .overlay { align-items: stretch; }
  .modal {
    max-width: 100%;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
  /* La entrada como hoja se gatea bajo enter-active (no siempre-activa). */
  .modal-enter-active .modal { animation: cwm-sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .modal-leave-active .modal { animation: cwm-sheet-down 0.18s ease forwards; }
  .person-row { flex-wrap: wrap; }
  .mini-picker { min-width: calc(50% - 1rem); }
}

@keyframes cwm-sheet-down {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}

@keyframes cwm-sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>

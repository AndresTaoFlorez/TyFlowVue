<script setup>
import '@/presentation/styles/calendar/CreateWorkWindowModal.css'
import '@/presentation/styles/components/calendar/cal-modal.css'
import { ref, watch, computed, nextTick } from 'vue'
import { fmtDateISO } from '@/presentation/helpers/formatDate'

const props = defineProps({
  visible: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  specialists: { type: Array, default: () => [] },
  prefill: { type: Object, default: null },
})

const emit = defineEmits(['close', 'create'])

// ---- Form state ----
// Estilo Google Calendar: SIEMPRE inicio (fecha+hora) → fin (fecha+hora).
// Las ventanas son disponibilidad PURA del especialista — sin aplicación ni
// afinidad. Una sola ventana por persona, que puede cruzar días.
const startDate = ref('')
const startTime = ref('08:00')
const endDate = ref('')
const endTime = ref('17:00')
const inheritsOnReopen = ref(false)

// Rows: cada fila es un especialista (turno compartido = varias filas).
const rows = ref([{ specialistId: '' }])

const addRow = () => { rows.value.push({ specialistId: '' }) }
const removeRow = (i) => { if (rows.value.length > 1) rows.value.splice(i, 1) }

// ---- Dropdown (un picker de especialista por fila) ----
const activeDropdown = ref(null) // 'spec-0', etc.
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

// Un especialista ya elegido en otra fila no se vuelve a ofrecer.
// OJO: NO aplanar las entidades User con spread — `fullName` es un getter y el
// spread lo descarta (la opción quedaría sin nombre). Se devuelven las
// instancias y el "ya agregado" se calcula aparte (ver [[feedback_no_double_wrap_entities]]).
const usedSpecIds = computed(() => new Set(rows.value.map(r => r.specialistId).filter(Boolean)))

const filteredSpecs = computed(() => {
  const q = dropdownSearch.value.toLowerCase().trim()
  if (!q) return props.specialists
  return props.specialists.filter(s => s.fullName.toLowerCase().includes(q))
})

const specName = (id) => props.specialists.find(s => s.specialistId === id)?.fullName || ''

const selectSpec = (rowIdx, s) => {
  if (rows.value.some((r, i) => i !== rowIdx && r.specialistId === s.specialistId)) return
  rows.value[rowIdx].specialistId = s.specialistId
  activeDropdown.value = null
}

// ---- Date helpers ----
const todayISO = () => fmtDateISO(new Date())

const onStartDateChange = (val) => {
  if (!val || isPastDate(val)) return
  const oldStart = startDate.value
  startDate.value = val
  if (!endDate.value || endDate.value === oldStart || endDate.value < val) {
    endDate.value = val
  }
}

// Duración real entre (startDate, startTime) y (endDate, endTime).
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

const crossesDays = computed(() =>
  !!startDate.value && !!endDate.value && endDate.value !== startDate.value
)

// ---- Validación ----
const isPastDate = (iso) => iso < todayISO()

const endTimeError = computed(() => {
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

const hasCompleteRow = computed(() => rows.value.some(r => r.specialistId))

watch(hasCompleteRow, (v) => { if (!v) inheritsOnReopen.value = false })

const timeOrderError = computed(() => {
  if (!startTime.value || !endTime.value) return null
  if (endDate.value && endDate.value > (startDate.value ?? '')) return null
  const [sh, sm] = startTime.value.split(':').map(Number)
  const [eh, em] = endTime.value.split(':').map(Number)
  if (sh * 60 + sm >= eh * 60 + em) return 'La hora de inicio debe ser anterior a la de fin.'
  return null
})

const totalWindows = computed(() => rows.value.filter(r => r.specialistId).length)

const canSubmit = computed(() => {
  if (!startDate.value || !endDate.value) return false
  if (endDate.value < startDate.value) return false
  if (!startTime.value || !endTime.value) return false
  if (timeOrderError.value) return false
  if (endTimeError.value) return false
  return rows.value.some(r => r.specialistId)
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
  _fixEndTime()
  rows.value = [{ specialistId: '' }]
  inheritsOnReopen.value = false
})

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
  const validRows = rows.value.filter(r => r.specialistId)
  const useEndDate = endDate.value && endDate.value !== startDate.value
  const windows = validRows.map(row => ({
    specialistId: row.specialistId,
    startTime: startTime.value,
    endTime: endTime.value,
    scheduledDate: startDate.value,
    ...(useEndDate ? { endDate: endDate.value } : {}),
    inheritsOnReopen: inheritsOnReopen.value,
  }))
  emit('create', windows)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cwm-modal">
      <div v-if="visible" class="overlay" @click.self="$emit('close')">
        <div class="modal cwm" @click="closeDropdowns">
          <!-- Header -->
          <header class="cwm__head">
            <div class="cwm__head-icon"><i class='bx bx-calendar-plus'></i></div>
            <div class="cwm__head-text">
              <h2 class="cwm__title">Nueva ventana de trabajo</h2>
              <p class="cwm__sub">Disponibilidad de uno o varios especialistas</p>
            </div>
            <button @click="$emit('close')" class="cwm__close" :disabled="creating" aria-label="Cerrar">
              <i class='bx bx-x'></i>
            </button>
          </header>

          <div class="cwm__body">
            <!-- Horario (héroe) -->
            <section class="cwm__sched" @click.stop="closeDropdowns">
              <div class="cwm__sched-rail"><i class='bx bx-time-five'></i></div>
              <div class="cwm__sched-fields">
                <div class="cwm__seg-row">
                  <span class="cwm__seg-tag">Inicio</span>
                  <div class="cwm__seg" :class="{ 'cwm__seg--err': timeOrderError }">
                    <input :value="startDate" @input="onStartDateChange($event.target.value)"
                      type="date" :min="todayISO()" class="cwm__date" :disabled="creating" title="Fecha de inicio">
                    <span class="cwm__seg-div"></span>
                    <input v-model="startTime" type="time" class="cwm__time" :disabled="creating" title="Hora de inicio">
                  </div>
                </div>

                <div class="cwm__seg-row">
                  <span class="cwm__seg-tag">Fin</span>
                  <div class="cwm__seg" :class="{ 'cwm__seg--err': timeOrderError || endTimeError }">
                    <input v-model="endDate" type="date" :min="startDate || todayISO()"
                      class="cwm__date" :disabled="creating" title="Fecha de fin">
                    <span class="cwm__seg-div"></span>
                    <input v-model="endTime" type="time" class="cwm__time" :disabled="creating" title="Hora de fin">
                  </div>
                </div>

                <div class="cwm__sched-meta">
                  <span v-if="timeOrderError || endTimeError" class="cwm__meta-err">
                    <i class='bx bx-error-circle'></i> {{ timeOrderError || endTimeError }}
                  </span>
                  <template v-else>
                    <span v-if="durationLabel" class="cwm__dur">{{ durationLabel }}</span>
                    <span v-if="crossesDays" class="cwm__multiday"><i class='bx bx-calendar'></i> Cruza días</span>
                  </template>
                </div>
              </div>
            </section>

            <!-- Especialistas -->
            <section class="cwm__people">
              <div class="cwm__sched-rail"><i class='bx bx-user'></i></div>
              <div class="cwm__people-list">
                <div class="cwm__people-label">{{ rows.length > 1 ? 'Especialistas del turno' : 'Especialista' }}</div>

                <div v-for="(row, i) in rows" :key="i" class="cwm__person">
                  <div class="picker" :class="{ 'picker--open': activeDropdown === `spec-${i}`, 'picker--filled': row.specialistId }"
                    @click.stop="openDropdown(`spec-${i}`)">
                    <span v-if="activeDropdown !== `spec-${i}`" class="picker__value">
                      {{ specName(row.specialistId) || 'Elegir especialista' }}
                    </span>
                    <input
                      v-else
                      ref="searchInput"
                      v-model="dropdownSearch"
                      class="picker__search"
                      placeholder="Buscar especialista…"
                      @click.stop
                      @keydown.escape="closeDropdowns"
                    >
                    <i v-if="activeDropdown !== `spec-${i}`" class='bx bx-chevron-down picker__caret'></i>
                    <Transition name="dropdown">
                      <div v-if="activeDropdown === `spec-${i}`" class="picker__menu" @mousedown.prevent>
                        <div
                          v-for="s in filteredSpecs"
                          :key="s.specialistId"
                          class="picker__opt"
                          :class="{ 'picker__opt--active': s.specialistId === row.specialistId, 'picker__opt--used': usedSpecIds.has(s.specialistId) && s.specialistId !== row.specialistId }"
                          @click.stop="!usedSpecIds.has(s.specialistId) || s.specialistId === row.specialistId ? selectSpec(i, s) : null"
                        >
                          <span>{{ s.fullName }}</span>
                          <i v-if="s.specialistId === row.specialistId" class='bx bx-check'></i>
                          <span v-else-if="usedSpecIds.has(s.specialistId)" class="picker__opt-tag">ya agregado</span>
                        </div>
                        <div v-if="filteredSpecs.length === 0" class="picker__empty">Sin resultados</div>
                      </div>
                    </Transition>
                  </div>
                  <button v-if="rows.length > 1" class="cwm__person-rm" @click.stop="removeRow(i)" :disabled="creating" aria-label="Quitar">
                    <i class='bx bx-x'></i>
                  </button>
                </div>

                <button class="cwm__add" @click.stop="addRow" :disabled="creating">
                  <i class='bx bx-plus'></i> Agregar especialista
                </button>
              </div>
            </section>

            <!-- Herencia -->
            <section class="cwm__toggle-row" :class="{ 'cwm__toggle-row--off': !hasCompleteRow }">
              <div class="cwm__sched-rail"><i class='bx bx-transfer' :class="{ 'cwm__rail--active': inheritsOnReopen }"></i></div>
              <button type="button" class="cwm__toggle-main"
                :disabled="!hasCompleteRow"
                @click.stop="inheritsOnReopen = !inheritsOnReopen">
                <span class="cwm__toggle-text">
                  <span class="cwm__toggle-title">Heredar de la ventana anterior</span>
                  <span class="cwm__toggle-hint">Continúa el conteo de la última ventana cerrada del especialista.</span>
                </span>
                <span class="switch" :class="{ 'switch--on': inheritsOnReopen }"><span class="switch__knob"></span></span>
              </button>
            </section>

            <div v-if="error" class="cwm__error">
              <i class='bx bx-error-circle'></i> {{ error }}
            </div>
          </div>

          <!-- Footer -->
          <footer class="cwm__foot">
            <span v-if="totalWindows > 1" class="cwm__count">{{ totalWindows }} ventanas</span>
            <button class="mbtn" @click="$emit('close')" :disabled="creating">Cancelar</button>
            <button class="mbtn mbtn--primary" :disabled="creating || !canSubmit" @click="handleSubmit">
              <i v-if="creating" class='bx bx-loader-alt bx-spin'></i>
              {{ totalWindows > 1 ? 'Crear ventanas' : 'Crear' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

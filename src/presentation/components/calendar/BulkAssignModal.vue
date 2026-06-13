<script setup>
import '@/presentation/styles/calendar/BulkAssignModal.css'
import '@/presentation/styles/components/calendar/cal-modal.css'
import { ref, computed, watch, nextTick } from 'vue'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'
import { fmtDateISO } from '@/presentation/helpers/formatDate'

const props = defineProps({
  visible: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  specialists: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'create'])

const MAX_WINDOWS = 200
const NEVER_HORIZON_WEEKS = 12

// ---- Selección de especialistas ----
const pickedSpecs = ref([])
const specSearchOpen = ref(false)
const specQuery = ref('')
const specS = ref(null)

const filteredSpecs = computed(() => {
  const q = specQuery.value.trim().toLowerCase()
  if (!q) return props.specialists
  return props.specialists.filter(s => s.fullName.toLowerCase().includes(q))
})

function toggleSpec(id) {
  const i = pickedSpecs.value.indexOf(id)
  if (i === -1) pickedSpecs.value.push(id)
  else pickedSpecs.value.splice(i, 1)
}

function allSpecs() {
  pickedSpecs.value = pickedSpecs.value.length === props.specialists.length
    ? [] : props.specialists.map(s => s.specialistId)
}

function toggleSpecSearch() {
  specSearchOpen.value = !specSearchOpen.value
  if (specSearchOpen.value) nextTick(() => specS.value?.focus())
  else specQuery.value = ''
}

// Cada especialista elegido = una serie (las ventanas son disponibilidad pura,
// sin aplicación). El backend ya no exige app asignada.
const combos = computed(() => pickedSpecs.value.map(sid => ({ specialistId: sid })))

// ---- Horario ----
const startStr = ref('08:00')
const endStr = ref('17:00')

const durMins = computed(() => {
  const [sh, sm] = startStr.value.split(':').map(Number)
  const [eh, em] = endStr.value.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
})

const durLabel = computed(() => {
  if (durMins.value <= 0) return ''
  const h = Math.floor(durMins.value / 60)
  const m = durMins.value % 60
  return ((h ? h + 'h' : '') + (m ? ' ' + m + 'm' : '')).trim()
})

// ---- Días de la semana (lunes-first: 0=L … 6=D) ----
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const days = ref([])

function toggleDay(i) {
  const idx = days.value.indexOf(i)
  if (idx === -1) days.value.push(i)
  else days.value.splice(idx, 1)
}

// ---- Periodo ----
const todayISO = () => fmtDateISO(new Date())

function _addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return fmtDateISO(d)
}

const fromDate = ref('')
const toDate = ref('')

const INTERVAL_OPTIONS = [
  [1, 'Cada semana'],
  [2, 'Cada 2 semanas'],
  [4, 'Cada 4 semanas'],
]
const weekStep = ref(1)

function onFromChange(val) {
  if (!val || val < todayISO()) return
  fromDate.value = val
  if (!toDate.value || toDate.value < val) toDate.value = val
}

function _startsInPast(iso) {
  const today = todayISO()
  if (iso < today) return true
  if (iso > today) return false
  const [h, m] = startStr.value.split(':').map(Number)
  const now = new Date()
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes()
}

function _weekdayOf(iso) {
  const jsDay = new Date(iso + 'T12:00:00').getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

const expandedDates = computed(() => {
  if (!fromDate.value || !toDate.value || toDate.value < fromDate.value) return []
  if (days.value.length === 0) return []

  const startMonday = _addDays(fromDate.value, -_weekdayOf(fromDate.value))
  const startMs = new Date(startMonday + 'T12:00:00').getTime()
  const selected = new Set(days.value)
  const out = []

  let iso = fromDate.value
  while (iso <= toDate.value && out.length <= MAX_WINDOWS) {
    if (selected.has(_weekdayOf(iso)) && !_startsInPast(iso)) {
      const weekIdx = Math.floor((new Date(iso + 'T12:00:00').getTime() - startMs) / (7 * 86400000))
      if (weekIdx % weekStep.value === 0) out.push(iso)
    }
    iso = _addDays(iso, 1)
  }
  return out
})

const count = computed(() => combos.value.length * expandedDates.value.length)
const overLimit = computed(() => count.value > MAX_WINDOWS)

const repText = computed(() => {
  if (!fromDate.value || !toDate.value) return ''
  const step = weekStep.value > 1 ? ` cada ${weekStep.value} semanas` : ''
  return `del ${fromDate.value} al ${toDate.value}${step}`
})

const valid = computed(() =>
  combos.value.length > 0 &&
  expandedDates.value.length > 0 &&
  durMins.value > 0 &&
  !overLimit.value
)

// Emite la serie estructurada: el store crea una serie por especialista vía
// POST /work-windows (las ocurrencias ya van expandidas).
function submit() {
  if (!valid.value || props.creating) return
  emit('create', {
    combos: combos.value,
    dates: expandedDates.value,
    startTime: startStr.value,
    endTime: endStr.value,
  })
}

// Reset al abrir
watch(() => props.visible, (v) => {
  if (!v) return
  pickedSpecs.value = []
  specQuery.value = ''
  specSearchOpen.value = false
  startStr.value = '08:00'
  endStr.value = '17:00'
  days.value = []
  fromDate.value = todayISO()
  toDate.value = _addDays(todayISO(), NEVER_HORIZON_WEEKS * 7 - 1)
  weekStep.value = 1
})
</script>

<template>
  <Teleport to="body">
    <Transition name="bam-modal">
      <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
        <div class="modal modal--bulk bam">
          <!-- Header -->
          <header class="bam__head">
            <div class="bam__head-icon"><i class='bx bx-calendar-week'></i></div>
            <div class="bam__head-text">
              <h2 class="bam__title">Asignación masiva</h2>
              <p class="bam__sub">Disponibilidad para varios especialistas a la vez</p>
            </div>
            <button class="bam__close" @click="$emit('close')" :disabled="creating" aria-label="Cerrar">
              <i class='bx bx-x'></i>
            </button>
          </header>

          <!-- Body -->
          <div class="modal__body">
            <!-- Especialistas -->
            <div class="bfield">
              <div class="bfield__head">
                <label class="bfield__label">Especialistas <span class="bfield__n">{{ pickedSpecs.length }}</span></label>
                <div class="bfield__tools">
                  <button class="bfield__link" @click="allSpecs">
                    {{ specialists.length && pickedSpecs.length === specialists.length ? 'Quitar todos' : 'Todos' }}
                  </button>
                  <button class="bfield__lupa" :class="{ 'bfield__lupa--on': specSearchOpen }" @click="toggleSpecSearch" title="Buscar">
                    <i class="bx bx-search"></i>
                  </button>
                </div>
              </div>
              <div v-show="specSearchOpen" class="bsearch">
                <i class="bx bx-search"></i>
                <input ref="specS" v-model="specQuery" type="text" placeholder="Buscar especialista…" />
              </div>
              <div class="pillwrap">
                <button v-for="s in filteredSpecs" :key="s.specialistId"
                  class="pill" :class="{ 'pill--on': pickedSpecs.includes(s.specialistId) }"
                  @click="toggleSpec(s.specialistId)">
                  <UserAvatar :preferences="s.preferences" :name="s.fullName" size="20px" class="pill__av" />
                  <span class="pill__txt">{{ s.fullName }}</span>
                  <i class="bx bx-x pill__x"></i>
                </button>
                <div v-if="!filteredSpecs.length" class="bempty">Sin resultados</div>
              </div>
            </div>

            <!-- Horario -->
            <div class="bfield">
              <label class="bfield__label">Horario</label>
              <div class="timerow">
                <div class="timebox">
                  <input type="time" step="1800" v-model="startStr" :disabled="creating" />
                  <span class="timebox__sep">–</span>
                  <input type="time" step="1800" v-model="endStr" :disabled="creating" />
                </div>
                <span class="timedur">{{ durLabel || '—' }}</span>
              </div>
            </div>

            <!-- Periodo: día de inicio y día de fin del rango -->
            <div class="bfield">
              <label class="bfield__label">Periodo</label>
              <div class="periodrow">
                <div class="periodbox">
                  <span class="periodbox__lbl">Desde</span>
                  <input type="date" :value="fromDate" :min="todayISO()" class="bdate"
                    :disabled="creating" @input="onFromChange($event.target.value)" />
                </div>
                <span class="periodrow__sep">–</span>
                <div class="periodbox">
                  <span class="periodbox__lbl">Hasta</span>
                  <input type="date" v-model="toDate" :min="fromDate || todayISO()" class="bdate"
                    :disabled="creating" />
                </div>
              </div>
            </div>

            <!-- Días de la semana dentro del periodo -->
            <div class="bfield">
              <label class="bfield__label">Días de la semana</label>
              <div class="daypick">
                <button v-for="(d, i) in DAY_LABELS" :key="i"
                  class="daypick__btn"
                  :class="{ 'daypick__btn--on': days.includes(i), 'daypick__btn--weekend': i >= 5 }"
                  :disabled="creating"
                  @click="toggleDay(i)">{{ d }}</button>
              </div>
            </div>

            <!-- Intervalo (opcional) -->
            <div class="bfield">
              <label class="bfield__label">Intervalo</label>
              <div class="chiprow">
                <button type="button" v-for="[v, l] in INTERVAL_OPTIONS" :key="v"
                  class="chip chip--sm" :class="{ 'chip--on': weekStep === v }" :disabled="creating"
                  @click="weekStep = v">{{ l }}</button>
              </div>
            </div>

            <!-- Error del backend -->
            <div v-if="error" class="merror">
              <i class='bx bx-error-circle'></i> {{ error }}
            </div>
          </div>

          <!-- Footer -->
          <div class="modal__foot modal__foot--bulk">
            <div v-if="overLimit" class="bsummary bsummary--error">
              <b>{{ count }}</b> ventanas supera el máximo de {{ MAX_WINDOWS }} — reduce especialistas, días o repeticiones.
            </div>
            <div v-else-if="valid" class="bsummary">
              <b>{{ count }}</b> ventana{{ count === 1 ? '' : 's' }} · <b>{{ durLabel }}</b> c/u<span v-if="repText" class="bsummary__rep"> · {{ repText }}</span>
            </div>
            <div v-else class="bsummary bsummary--empty">Elige especialistas, periodo y días</div>
            <div class="modal__foot-actions">
              <button class="mbtn" @click="$emit('close')" :disabled="creating">Cancelar</button>
              <button class="mbtn mbtn--primary" :disabled="!valid || creating" @click="submit">
                <i v-if="creating" class='bx bx-loader-alt bx-spin'></i>
                Crear{{ valid ? ' ' + count : '' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

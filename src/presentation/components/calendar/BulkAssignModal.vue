<script setup>
import '@/styles/components/calendar/cal-modal.css'
import { ref, computed, watch, nextTick } from 'vue'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'
import { fmtDateISO } from '@/presentation/helpers/formatDate'

const props = defineProps({
  visible: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'create'])

const MAX_WINDOWS = 200
const NEVER_HORIZON_WEEKS = 12

// ---- Selección de especialistas / apps ----
const pickedSpecs = ref([])
const pickedApps = ref([])
const specSearchOpen = ref(false)
const appSearchOpen = ref(false)
const specQuery = ref('')
const appQuery = ref('')
const specS = ref(null)
const appS = ref(null)

// Solo especialistas con apps asignadas (igual que el modal de creación)
const assignableSpecs = computed(() =>
  props.specialists.filter(s => s.applicationAssignments?.length > 0)
)

const filteredSpecs = computed(() => {
  const q = specQuery.value.trim().toLowerCase()
  if (!q) return assignableSpecs.value
  return assignableSpecs.value.filter(s => s.fullName.toLowerCase().includes(q))
})

const filteredApps = computed(() => {
  const q = appQuery.value.trim().toLowerCase()
  if (!q) return props.applications
  return props.applications.filter(a => a.name.toLowerCase().includes(q))
})

function toggleSpec(id) {
  const i = pickedSpecs.value.indexOf(id)
  if (i === -1) pickedSpecs.value.push(id)
  else pickedSpecs.value.splice(i, 1)
}

function toggleApp(id) {
  const i = pickedApps.value.indexOf(id)
  if (i === -1) pickedApps.value.push(id)
  else pickedApps.value.splice(i, 1)
}

function allSpecs() {
  pickedSpecs.value = pickedSpecs.value.length === assignableSpecs.value.length
    ? [] : assignableSpecs.value.map(s => s.specialistId)
}

function allApps() {
  pickedApps.value = pickedApps.value.length === props.applications.length
    ? [] : props.applications.map(a => a.id)
}

function toggleSpecSearch() {
  specSearchOpen.value = !specSearchOpen.value
  if (specSearchOpen.value) nextTick(() => specS.value?.focus())
  else specQuery.value = ''
}

function toggleAppSearch() {
  appSearchOpen.value = !appSearchOpen.value
  if (appSearchOpen.value) nextTick(() => appS.value?.focus())
  else appQuery.value = ''
}

// Combos válidos: el especialista debe tener la app asignada (el backend lo exige)
const validCombos = computed(() => {
  const combos = []
  for (const sid of pickedSpecs.value) {
    const spec = assignableSpecs.value.find(s => s.specialistId === sid)
    if (!spec) continue
    const allowed = new Set(spec.applicationAssignments.map(a => a.application_id || a.id || a))
    for (const appId of pickedApps.value) {
      if (allowed.has(appId)) combos.push({ specialistId: sid, applicationId: appId })
    }
  }
  return combos
})

const skippedCombos = computed(() =>
  pickedSpecs.value.length * pickedApps.value.length - validCombos.value.length
)

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

// ---- Periodo (lo básico: día de inicio y día de fin del rango) ----
const todayISO = () => fmtDateISO(new Date())

function _addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return fmtDateISO(d)
}

const fromDate = ref('')
const toDate = ref('')

// Intervalo: los weekdays elegidos se repiten cada N semanas dentro del periodo
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

// ¿La fecha+hora de inicio ya pasó? (el store rechaza inicios en el pasado)
function _startsInPast(iso) {
  const today = todayISO()
  if (iso < today) return true
  if (iso > today) return false
  const [h, m] = startStr.value.split(':').map(Number)
  const now = new Date()
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes()
}

// weekday lunes-first (0=L…6=D) de una fecha ISO
function _weekdayOf(iso) {
  const jsDay = new Date(iso + 'T12:00:00').getDay() // 0=Dom…6=Sáb
  return jsDay === 0 ? 6 : jsDay - 1
}

// ---- Expansión: recorre [desde, hasta] e incluye los weekdays elegidos ----
// El intervalo cuenta semanas desde el lunes de la semana de "desde":
// cada N semanas se incluye la semana completa, las demás se saltan.
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

const count = computed(() => validCombos.value.length * expandedDates.value.length)
const overLimit = computed(() => count.value > MAX_WINDOWS)

const repText = computed(() => {
  if (!fromDate.value || !toDate.value) return ''
  const step = weekStep.value > 1 ? ` cada ${weekStep.value} semanas` : ''
  return `del ${fromDate.value} al ${toDate.value}${step}`
})

const valid = computed(() =>
  validCombos.value.length > 0 &&
  expandedDates.value.length > 0 &&
  durMins.value > 0 &&
  !overLimit.value
)

// Emite la serie estructurada: el backend (POST /work-windows/recurring)
// crea cada serie por combo de forma atómica y encadena la herencia solo.
function submit() {
  if (!valid.value || props.creating) return
  emit('create', {
    combos: validCombos.value,
    dates: expandedDates.value,
    startTime: startStr.value,
    endTime: endStr.value,
    affinityWeight: 1,
  })
}

// Reset al abrir
watch(() => props.visible, (v) => {
  if (!v) return
  pickedSpecs.value = []
  pickedApps.value = []
  specQuery.value = ''
  appQuery.value = ''
  specSearchOpen.value = false
  appSearchOpen.value = false
  startStr.value = '08:00'
  endStr.value = '17:00'
  days.value = []
  fromDate.value = todayISO()
  toDate.value = _addDays(todayISO(), NEVER_HORIZON_WEEKS * 7 - 1)
  weekStep.value = 1
})

const appColorOf = (a) => a.color || a.theme?.color || '#2AC78F'
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
        <div class="modal modal--bulk bam">
          <!-- Header -->
          <div class="modal__head">
            <div>
              <div class="modal__title">Asignación masiva</div>
              <div class="modal__sub">Disponibilidad para varios especialistas a la vez</div>
            </div>
            <button class="modal__x" @click="$emit('close')" :disabled="creating">&times;</button>
          </div>

          <!-- Body -->
          <div class="modal__body">
            <!-- Especialistas -->
            <div class="bfield">
              <div class="bfield__head">
                <label class="bfield__label">Especialistas <span class="bfield__n">{{ pickedSpecs.length }}</span></label>
                <div class="bfield__tools">
                  <button class="bfield__link" @click="allSpecs">
                    {{ assignableSpecs.length && pickedSpecs.length === assignableSpecs.length ? 'Quitar todos' : 'Todos' }}
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

            <!-- Aplicaciones -->
            <div class="bfield">
              <div class="bfield__head">
                <label class="bfield__label">Aplicaciones <span class="bfield__n">{{ pickedApps.length }}</span></label>
                <div class="bfield__tools">
                  <button class="bfield__link" @click="allApps">
                    {{ applications.length && pickedApps.length === applications.length ? 'Quitar todas' : 'Todas' }}
                  </button>
                  <button class="bfield__lupa" :class="{ 'bfield__lupa--on': appSearchOpen }" @click="toggleAppSearch" title="Buscar">
                    <i class="bx bx-search"></i>
                  </button>
                </div>
              </div>
              <div v-show="appSearchOpen" class="bsearch">
                <i class="bx bx-search"></i>
                <input ref="appS" v-model="appQuery" type="text" placeholder="Buscar aplicación…" />
              </div>
              <div class="pillwrap">
                <button v-for="a in filteredApps" :key="a.id"
                  class="pill" :class="{ 'pill--on': pickedApps.includes(a.id) }"
                  @click="toggleApp(a.id)">
                  <span class="pill__dot" :style="{ background: appColorOf(a) }"></span>
                  <span class="pill__txt">{{ a.name }}</span>
                  <i class="bx bx-x pill__x"></i>
                </button>
                <div v-if="!filteredApps.length" class="bempty">Sin resultados</div>
              </div>
              <div v-if="skippedCombos > 0" class="bam__note">
                <i class='bx bx-info-circle'></i>
                {{ skippedCombos }} combinación(es) se omiten: especialista sin esa app asignada.
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

            <!-- Periodo: lo básico — día de inicio y día de fin del rango -->
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
            <div v-else class="bsummary bsummary--empty">Elige especialistas, apps, periodo y días</div>
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

<style scoped>
.bam__note {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: var(--muted);
}

.bam__note i { font-size: 0.9rem; flex-shrink: 0; }

/* ── Periodo (Desde – Hasta) ── */
.periodrow {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.periodrow__sep {
  color: var(--muted);
  font-size: 0.85rem;
  padding-bottom: 0.55rem;
}

.periodbox {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.periodbox__lbl {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

/* Transición (gateada bajo las clases del <Transition>) */
.modal-enter-active { transition: opacity 0.18s ease; }
.modal-enter-active .bam { animation: bam-pop-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-leave-active .bam { animation: bam-pop-out 0.15s ease forwards; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@keyframes bam-pop-in {
  from { transform: scale(0.93) translateY(6px); opacity: 0; }
  to   { transform: scale(1)    translateY(0);   opacity: 1; }
}
@keyframes bam-pop-out {
  from { transform: scale(1)    translateY(0);   opacity: 1; }
  to   { transform: scale(0.93) translateY(6px); opacity: 0; }
}

@media (max-width: 480px) {
  .modal-enter-active .bam { animation: bam-sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .modal-leave-active .bam { animation: bam-sheet-down 0.18s ease forwards; }
}

@keyframes bam-sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes bam-sheet-down {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
</style>

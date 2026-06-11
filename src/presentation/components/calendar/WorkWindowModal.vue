<script setup>
import '@/styles/components/calendar/cal-modal.css'
import { ref, computed, watch, onMounted } from 'vue'
import { fmtForInput, fmtTime12h } from '@/presentation/helpers/formatTime'
import { fmtDateLocale, dateFromTimestamp } from '@/presentation/helpers/formatDate'

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  applicationName: { type: String, default: '—' },
  appColor: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  startInEditMode: { type: Boolean, default: false },
  showBackButton: { type: Boolean, default: false },
  hasClipboard: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'toggle', 'delete', 'update', 'back', 'disinherit', 'reinherit', 'copy', 'cut', 'add-specialist', 'paste'])

const idCopied = ref(false)
const inheritIdCopied = ref(false)

async function copyId(text, flagRef) {
  try {
    await navigator.clipboard.writeText(text)
    flagRef.value = true
    setTimeout(() => { flagRef.value = false }, 1500)
  } catch { /* fallback: ignore */ }
}

const isFuture = computed(() => props.window?.isFuture ?? false)
const isEnded = computed(() => props.window?.isEnded ?? false)

const hasInheritance = computed(() => !!(props.window.inheritedFromWindowId || props.window.inheritsOnReopen))
const canToggleInheritance = computed(() => isFuture.value)

// ---- Edit mode ----
const editing = ref(false)
const editStartDate = ref('')
const editStartTime = ref('')
const editEndDate = ref('')
const editEndTime = ref('')
const editNote = ref('')
const editAffinityWeight = ref('')

const fmtDate = (date) => fmtDateLocale(date)

function enterEdit() {
  // §4 de las reglas: sellada (ya inició, en turno o finalizada) = inmutable.
  if (!isFuture.value) return
  editStartDate.value = dateFromTimestamp(props.window.startsAt) || props.window.scheduledDate || ''
  editStartTime.value = fmtForInput(props.window.startTime)
  editEndDate.value = dateFromTimestamp(props.window.endsAt) || props.window.scheduledDate || ''
  editEndTime.value = fmtForInput(props.window.endTime)
  editNote.value = ''
  editAffinityWeight.value = props.window.affinityWeight != null ? String(parseFloat(props.window.affinityWeight.toFixed(2))) : '1'
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function saveEdit() {
  const payload = {}
  const origStartDate = dateFromTimestamp(props.window.startsAt) || props.window.scheduledDate || ''
  const origEndDate = dateFromTimestamp(props.window.endsAt) || props.window.scheduledDate || ''
  const origStartTime = fmtForInput(props.window.startTime)
  const origEndTime = fmtForInput(props.window.endTime)

  const startDateChanged = editStartDate.value !== origStartDate
  const endDateChanged = editEndDate.value !== origEndDate
  const startTimeChanged = editStartTime.value !== origStartTime
  const endTimeChanged = editEndTime.value !== origEndTime

  // Solo se llega aquí con ventanas futuras (§4: selladas no se editan)
  if (startDateChanged) payload.targetDate = editStartDate.value
  if (startTimeChanged || startDateChanged) payload.startTime = editStartTime.value
  if (endDateChanged) payload.endDate = editEndDate.value
  if (endTimeChanged || endDateChanged) payload.endTime = editEndTime.value
  if (editNote.value.trim()) payload.note = editNote.value.trim()

  const origWeight = props.window.affinityWeight != null ? String(parseFloat(props.window.affinityWeight.toFixed(2))) : '1'
  if (editAffinityWeight.value !== origWeight) {
    payload.affinityWeight = editAffinityWeight.value ? parseFloat(editAffinityWeight.value) : null
  }

  if (Object.keys(payload).length === 0) {
    editing.value = false
    return
  }
  emit('update', props.window, payload)
}

onMounted(() => {
  if (props.startInEditMode && props.window) enterEdit()
})

watch(() => props.window?.id, () => {
  if (props.startInEditMode) { enterEdit() } else { editing.value = false }
})

const hasChanged = computed(() => {
  if (!editing.value) return false
  const origStartDate = dateFromTimestamp(props.window.startsAt) || props.window.scheduledDate || ''
  const origEndDate = dateFromTimestamp(props.window.endsAt) || props.window.scheduledDate || ''
  const origWeight = props.window.affinityWeight != null ? String(parseFloat(props.window.affinityWeight.toFixed(2))) : '1'

  const startChanged =
    editStartDate.value !== origStartDate ||
    editStartTime.value !== fmtForInput(props.window.startTime)
  const endChanged =
    editEndDate.value !== origEndDate ||
    editEndTime.value !== fmtForInput(props.window.endTime)

  return startChanged || endChanged ||
         editNote.value.trim() !== '' ||
         editAffinityWeight.value !== origWeight
})

const fmtDisplay = fmtTime12h

const statusLabel = computed(() => {
  if (isEnded.value) return 'Finalizada'
  return props.window.isActive ? 'Activa' : 'Inactiva'
})
const statusPillClass = computed(() => {
  if (isEnded.value) return 'pill-status--ended'
  return props.window.isActive ? 'pill-status--active' : 'pill-status--inactive'
})
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal wm" :style="{ '--app': appColor || 'var(--primary-500)' }">
      <div class="modal__top"></div>

      <!-- Header -->
      <div class="modal__head">
        <div class="wm__head-left">
          <button v-if="showBackButton" class="modal__icon-btn" title="Volver al grupo" @click="$emit('back')">
            <i class='bx bx-arrow-back'></i>
          </button>
          <div>
            <div class="modal__title">{{ specialistName }}</div>
            <div class="modal__sub">{{ editing ? 'Editar ventana de trabajo' : 'Ventana de trabajo' }}</div>
          </div>
        </div>
        <div class="modal__head-actions">
          <button v-if="!editing && isFuture" class="modal__icon-btn" title="Editar horario" @click="enterEdit">
            <i class='bx bx-pencil'></i>
          </button>
          <button class="modal__x" @click="$emit('close')" title="Cerrar">&times;</button>
        </div>
      </div>

      <!-- Body -->
      <div class="modal__body">
        <!-- Vista -->
        <template v-if="!editing">
          <div class="mrow">
            <i class='bx bx-grid-alt'></i>
            <span class="mrow__label">Aplicación</span>
            <span class="mrow__val">{{ applicationName }}</span>
          </div>
          <div class="mrow">
            <i class='bx bx-time-five'></i>
            <span class="mrow__label">Horario</span>
            <span class="mrow__val">{{ fmtDisplay(window.startTime) }} – {{ fmtDisplay(window.endTime) }}</span>
          </div>
          <div class="mrow">
            <i class='bx bx-calendar'></i>
            <span class="mrow__label">Día</span>
            <span class="mrow__val">{{ fmtDate(window.scheduledDate) }}</span>
          </div>
          <div class="mrow">
            <i class='bx bx-pulse'></i>
            <span class="mrow__label">Estado</span>
            <span class="pill-status" :class="statusPillClass">
              <i class='bx' :class="window.isActive && !isEnded ? 'bxs-circle' : 'bx-block'" style="font-size:0.6rem"></i>
              {{ statusLabel }}
            </span>
          </div>
          <div v-if="window.affinityWeight != null" class="mrow">
            <i class='bx bx-slider-alt'></i>
            <span class="mrow__label">Afinidad</span>
            <span class="mrow__val">{{ parseFloat(window.affinityWeight.toFixed(2)) }}</span>
          </div>

          <!-- Herencia -->
          <div v-if="hasInheritance || canToggleInheritance" class="mrow">
            <i class='bx bx-link'></i>
            <span class="mrow__label">Herencia</span>
            <span v-if="hasInheritance" class="pill-status pill-status--active">
              Hereda
              <button v-if="canToggleInheritance" class="wm__pill-x" @click="$emit('disinherit', window)" :disabled="loading" title="Desactivar herencia">
                <i class='bx bx-x'></i>
              </button>
            </span>
            <button v-else class="chip chip--sm" @click="$emit('reinherit', window)" :disabled="loading">
              <i class='bx bx-link'></i> Activar
            </button>
          </div>
          <div v-if="window.inheritedFromWindowId" class="wm__id-row" @click="copyId(window.inheritedFromWindowId, inheritIdCopied)" title="Copiar ID de ventana heredada">
            <i class='bx bx-subdirectory-right'></i>
            <span class="wm__id-label">Hereda de</span>
            <code class="wm__id-code">{{ window.inheritedFromWindowId }}</code>
            <i class='bx' :class="inheritIdCopied ? 'bx-check' : 'bx-copy'"></i>
          </div>

          <!-- Acciones rápidas (antes en el menú contextual flotante; ahora dentro
               del detalle para que no choquen con el long-press de mover). -->
          <div class="chiprow">
            <button class="chip chip--sm" @click="$emit('copy', window)">
              <i class='bx bx-copy'></i>Copiar
            </button>
            <button v-if="isFuture" class="chip chip--sm" @click="$emit('cut', window)">
              <i class='bx bx-cut'></i>Cortar
            </button>
            <button v-if="isFuture" class="chip chip--sm" @click="$emit('add-specialist', window)">
              <i class='bx bx-user-plus'></i>Agregar especialista
            </button>
            <button v-if="hasClipboard" class="chip chip--sm" @click="$emit('paste', window)">
              <i class='bx bx-paste'></i>Pegar aquí
            </button>
          </div>

          <!-- ID -->
          <div class="wm__id-row" @click="copyId(window.id, idCopied)" title="Copiar ID">
            <i class='bx bx-hash'></i>
            <code class="wm__id-code">{{ window.id }}</code>
            <i class='bx' :class="idCopied ? 'bx-check' : 'bx-copy'"></i>
          </div>
        </template>

        <!-- Edición (solo ventanas futuras — §4: selladas inmutables) -->
        <template v-else>
          <div class="mfield">
            <label class="mfield__label">Inicio</label>
            <div class="mgrid2">
              <input type="date" v-model="editStartDate" class="minput">
              <input type="time" v-model="editStartTime" class="minput">
            </div>
          </div>
          <div class="mfield">
            <label class="mfield__label">Fin</label>
            <div class="mgrid2">
              <input type="date" v-model="editEndDate" class="minput">
              <input type="time" v-model="editEndTime" class="minput">
            </div>
          </div>
          <div class="mfield">
            <label class="mfield__label">Nota (opcional)</label>
            <input v-model="editNote" type="text" class="minput" placeholder="Ej. turno extendido">
          </div>
          <div class="mfield">
            <label class="mfield__label">Peso de afinidad</label>
            <input v-model="editAffinityWeight" type="number" step="0.01" min="0.01" max="9.99"
              class="minput wm__weight-input" placeholder="Ej. 1.5">
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="modal__foot">
        <template v-if="editing">
          <button class="mbtn" @click="cancelEdit" :disabled="loading">Cancelar</button>
          <button class="mbtn mbtn--primary" @click="saveEdit" :disabled="loading || !hasChanged">
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            Guardar
          </button>
        </template>
        <template v-else>
          <button v-if="!isEnded" class="mbtn" :disabled="loading" @click="$emit('toggle', window)">
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            {{ window.isActive ? 'Inhabilitar' : 'Habilitar' }}
          </button>
          <!-- Regla de borrado: selladas (ya iniciaron o pasaron) NO se
               eliminan — solo ventanas futuras. -->
          <button class="mbtn mbtn--danger" :disabled="loading || !isFuture"
            :title="!isFuture ? 'No se puede eliminar una ventana que ya inició.' : undefined"
            @click="$emit('delete', window)">
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            Eliminar
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wm__head-left {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
}

/* X pequeña dentro del pill de herencia */
.wm__pill-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.12);
  color: inherit;
  font-size: 11px;
  cursor: pointer;
  margin-left: 2px;
}

.wm__pill-x:hover:not(:disabled) { background: rgba(0, 0, 0, 0.25); }
.wm__pill-x:disabled { opacity: 0.4; cursor: not-allowed; }

.wm__weight-input { max-width: 180px; }

/* Fila de ID copiable (discreta) */
.wm__id-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
  color: var(--muted);
  cursor: pointer;
  min-width: 0;
  transition: color 0.15s;
}

.wm__id-row:hover { color: var(--text); }

.wm__id-row > i:first-child {
  font-size: 0.95rem;
  width: 1.3rem;
  text-align: center;
  flex-shrink: 0;
}

.wm__id-row > i:last-child {
  font-size: 0.85rem;
  margin-left: auto;
  flex-shrink: 0;
}

.wm__id-label { font-weight: 600; flex-shrink: 0; }

.wm__id-code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.66rem;
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* Transiciones del padre <Transition name="ww-modal"> — la animación va
   gateada bajo la clase de la transición (nunca siempre-activa). */
.ww-modal-enter-active { transition: opacity 0.18s ease; }
.ww-modal-enter-active .wm { animation: wm-pop-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.ww-modal-leave-active { transition: opacity 0.15s ease; }
.ww-modal-leave-active .wm { animation: wm-pop-out 0.15s ease forwards; }
.ww-modal-enter-from, .ww-modal-leave-to { opacity: 0; }

@keyframes wm-pop-in {
  from { transform: scale(0.93) translateY(8px); opacity: 0; }
  to   { transform: scale(1)    translateY(0);   opacity: 1; }
}
@keyframes wm-pop-out {
  from { transform: scale(1)    translateY(0);   opacity: 1; }
  to   { transform: scale(0.93) translateY(8px); opacity: 0; }
}

/* Móvil: hoja a pantalla completa */
@media (max-width: 480px) {
  .ww-modal-enter-active .wm { animation: wm-sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .ww-modal-leave-active .wm { animation: wm-sheet-down 0.18s ease forwards; }
}

@keyframes wm-sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes wm-sheet-down {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
</style>

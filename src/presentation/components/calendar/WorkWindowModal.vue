<script setup>
import '@/presentation/styles/calendar/WorkWindowModal.css'
import '@/presentation/styles/components/calendar/cal-modal.css'
import { ref, computed, watch } from 'vue'
import { fmtForInput } from '@/presentation/helpers/formatTime'
import { dateFromTimestamp } from '@/presentation/helpers/formatDate'

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  loading: { type: Boolean, default: false },
  showBackButton: { type: Boolean, default: false },
  hasClipboard: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'toggle', 'delete', 'update', 'back', 'disinherit', 'reinherit', 'copy', 'cut', 'paste'])

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
// Sellado en dos niveles (§4): en turno (iniciada, no finalizada) el inicio
// queda congelado pero el FIN aún se puede ajustar.
const isInShift = computed(() => !isFuture.value && !isEnded.value)
const canEditWindow = computed(() => !isEnded.value)

const hasInheritance = computed(() => !!(props.window.inheritedFromWindowId || props.window.inheritsOnReopen))
const canToggleInheritance = computed(() => isFuture.value)

// ---- Campos del formulario (siempre montados: el modal ES el editor) ----
const editStartDate = ref('')
const editStartTime = ref('')
const editEndDate = ref('')
const editEndTime = ref('')
const editNote = ref('')

const origStartDate = computed(() => dateFromTimestamp(props.window.startsAt) || props.window.scheduledDate || '')
const origEndDate = computed(() => dateFromTimestamp(props.window.endsAt) || props.window.scheduledDate || '')

function syncFields() {
  editStartDate.value = origStartDate.value
  editStartTime.value = fmtForInput(props.window.startTime)
  editEndDate.value = origEndDate.value
  editEndTime.value = fmtForInput(props.window.endTime)
  editNote.value = ''
}

syncFields()
// Re-sincroniza cuando el padre reemplaza la instancia (tras guardar / cambio de ventana)
watch(() => props.window, syncFields)

const hasChanged = computed(() => {
  const startChanged =
    editStartDate.value !== origStartDate.value ||
    editStartTime.value !== fmtForInput(props.window.startTime)
  const endChanged =
    editEndDate.value !== origEndDate.value ||
    editEndTime.value !== fmtForInput(props.window.endTime)

  return startChanged || endChanged || editNote.value.trim() !== ''
})

// Rango inválido (fin antes o igual al inicio) → bloquea el guardado
const rangeMinutes = computed(() => {
  if (!editStartDate.value || !editEndDate.value || !editStartTime.value || !editEndTime.value) return null
  const s = new Date(`${editStartDate.value}T${editStartTime.value}`)
  const e = new Date(`${editEndDate.value}T${editEndTime.value}`)
  if (isNaN(s) || isNaN(e)) return null
  return Math.round((e - s) / 60000)
})
const invalidRange = computed(() => rangeMinutes.value != null && rangeMinutes.value <= 0)

const durationLabel = computed(() => {
  const mins = rangeMinutes.value
  if (mins == null || mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
})

const crossesDays = computed(() => editStartDate.value !== editEndDate.value)

// "Termina otro día": revela el campo de fecha de fin poniéndolo en el día
// siguiente al inicio (así crossesDays pasa a true y el rango sigue siendo válido).
function endsAnotherDay() {
  const base = editStartDate.value || origStartDate.value
  const d = new Date(`${base}T00:00:00`)
  if (isNaN(d)) return
  d.setDate(d.getDate() + 1)
  const pad = (n) => String(n).padStart(2, '0')
  editEndDate.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function discard() {
  syncFields()
}

function save() {
  if (!canEditWindow.value || !hasChanged.value || invalidRange.value) return
  const payload = {}
  const startDateChanged = editStartDate.value !== origStartDate.value
  const endDateChanged = editEndDate.value !== origEndDate.value
  const startTimeChanged = editStartTime.value !== fmtForInput(props.window.startTime)
  const endTimeChanged = editEndTime.value !== fmtForInput(props.window.endTime)

  // En turno (start seal) solo se permite tocar el fin — los inputs de inicio
  // van deshabilitados, pero por si acaso no se envían cambios suyos.
  if (isFuture.value) {
    if (startDateChanged) payload.targetDate = editStartDate.value
    if (startTimeChanged || startDateChanged) payload.startTime = editStartTime.value
  }
  if (endDateChanged) payload.endDate = editEndDate.value
  if (endTimeChanged || endDateChanged) payload.endTime = editEndTime.value
  if (editNote.value.trim()) payload.note = editNote.value.trim()

  if (Object.keys(payload).length === 0) return
  emit('update', props.window, payload)
}

const statusLabel = computed(() => {
  if (isEnded.value) return 'Finalizada'
  return props.window.isActive ? 'Activa' : 'Inactiva'
})
const statusPillClass = computed(() => {
  if (isEnded.value) return 'pill-status--ended'
  return props.window.isActive ? 'pill-status--active' : 'pill-status--inactive'
})

const shortId = computed(() => (props.window.id || '').slice(0, 8))
const initials = computed(() => {
  const parts = (props.specialistName || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
})
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal wm" @keydown.enter="save" @keydown.esc="$emit('close')">
      <!-- Header: avatar de iniciales + nombre + estado; ID copiable a la derecha -->
      <header class="wm__head">
        <button v-if="showBackButton" class="wm__back" title="Volver al grupo" @click="$emit('back')">
          <i class='bx bx-arrow-back'></i>
        </button>
        <div class="wm__avatar">{{ initials }}</div>
        <div class="wm__head-text">
          <h2 class="wm__title">{{ specialistName }}</h2>
          <span class="pill-status" :class="statusPillClass">{{ statusLabel }}</span>
        </div>
        <div class="wm__head-actions">
          <button class="wm__id-chip" :class="{ 'wm__id-chip--copied': idCopied }"
            :title="idCopied ? 'Copiado' : `Copiar ID\n${window.id}`" @click="copyId(window.id, idCopied)">
            <i class='bx' :class="idCopied ? 'bx-check' : 'bx-hash'"></i>
            <code>{{ idCopied ? 'Copiado' : shortId }}</code>
          </button>
          <button class="wm__close" @click="$emit('close')" title="Cerrar"><i class='bx bx-x'></i></button>
        </div>
      </header>

      <div class="modal__body wm__body">
        <p v-if="isInShift" class="wm__hint">
          <i class='bx bx-info-circle'></i>
          En turno: el inicio quedó sellado, solo puedes ajustar el fin.
        </p>
        <p v-else-if="isEnded" class="wm__hint wm__hint--muted">
          <i class='bx bx-lock-alt'></i>
          Ventana finalizada: el registro quedó sellado y es de solo lectura.
        </p>

        <!-- Horario editable inline -->
        <div class="wm__row">
          <i class='bx bx-time-five'></i>
          <div class="wm__schedule">
            <div class="wm__sched-line">
              <div class="wm__sched-group">
                <input type="date" v-model="editStartDate" class="wm__input wm__input--date"
                  :disabled="!isFuture" title="Fecha de inicio">
                <input type="time" v-model="editStartTime" class="wm__input wm__input--time"
                  :disabled="!isFuture" title="Hora de inicio">
              </div>
              <div class="wm__sched-group">
                <span class="wm__sched-sep">–</span>
                <input type="time" v-model="editEndTime" class="wm__input wm__input--time"
                  :disabled="isEnded" title="Hora de fin">
                <input v-if="crossesDays" type="date" v-model="editEndDate" class="wm__input wm__input--date"
                  :disabled="isEnded" title="Fecha de fin">
              </div>
            </div>
            <div class="wm__sched-meta">
              <span v-if="invalidRange" class="wm__sched-error">
                <i class='bx bx-error-circle'></i> El fin debe ser posterior al inicio
              </span>
              <span v-else-if="durationLabel" class="wm__sched-dur">{{ durationLabel }}</span>
              <button v-if="!crossesDays && !isEnded" class="wm__sched-link" @click="endsAnotherDay"
                type="button" title="Definir una fecha de fin distinta">
                Termina otro día
              </button>
            </div>
          </div>
        </div>

        <!-- Nota -->
        <div v-if="!isEnded" class="wm__row">
          <i class='bx bx-note'></i>
          <input v-model="editNote" type="text" class="wm__input wm__input--note"
            placeholder="Agregar una nota… (ej. turno extendido)">
        </div>

        <!-- Estado: switch interactivo -->
        <div class="wm__row">
          <i class='bx bx-pulse'></i>
          <span class="wm__row-label">{{ window.isActive && !isEnded ? 'Habilitada' : isEnded ? 'Finalizada' : 'Inhabilitada' }}</span>
          <button v-if="!isEnded" class="wm__switch" :class="{ 'wm__switch--on': window.isActive }"
            role="switch" :aria-checked="window.isActive" :disabled="loading"
            :title="window.isActive ? 'Inhabilitar ventana' : 'Habilitar ventana'"
            @click="$emit('toggle', window)">
            <span class="wm__switch-knob"></span>
          </button>
        </div>

        <!-- Herencia -->
        <div v-if="hasInheritance || canToggleInheritance" class="wm__row">
          <i class='bx bx-link'></i>
          <span class="wm__row-label">Herencia</span>
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

        <!-- Acciones rápidas -->
        <div class="chiprow">
          <button class="chip chip--sm" @click="$emit('copy', window)">
            <i class='bx bx-copy'></i>Copiar
          </button>
          <button v-if="isFuture" class="chip chip--sm" @click="$emit('cut', window)">
            <i class='bx bx-cut'></i>Cortar
          </button>
          <button v-if="hasClipboard" class="chip chip--sm" @click="$emit('paste', window)">
            <i class='bx bx-paste'></i>Pegar aquí
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal__foot">
        <template v-if="hasChanged && canEditWindow">
          <button class="mbtn" @click="discard" :disabled="loading">Descartar</button>
          <button class="mbtn mbtn--primary" @click="save" :disabled="loading || invalidRange">
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            Guardar cambios
          </button>
        </template>
        <template v-else>
          <button class="mbtn mbtn--danger" :disabled="loading || !isFuture"
            :title="!isFuture ? 'No se puede eliminar una ventana que ya inició.' : undefined"
            @click="$emit('delete', window)">
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            Eliminar
          </button>
          <button class="mbtn" @click="$emit('close')">Cerrar</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@/styles/components/calendar/cal-modal.css'
import { ref, computed, watch } from 'vue'
import { fmtForInput } from '@/presentation/helpers/formatTime'
import { dateFromTimestamp } from '@/presentation/helpers/formatDate'

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  applicationName: { type: String, default: '—' },
  appColor: { type: String, default: '' },
  loading: { type: Boolean, default: false },
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
const editAffinityWeight = ref('')

const origStartDate = computed(() => dateFromTimestamp(props.window.startsAt) || props.window.scheduledDate || '')
const origEndDate = computed(() => dateFromTimestamp(props.window.endsAt) || props.window.scheduledDate || '')
const origWeight = computed(() =>
  props.window.affinityWeight != null ? String(parseFloat(props.window.affinityWeight.toFixed(2))) : '1')

function syncFields() {
  editStartDate.value = origStartDate.value
  editStartTime.value = fmtForInput(props.window.startTime)
  editEndDate.value = origEndDate.value
  editEndTime.value = fmtForInput(props.window.endTime)
  editNote.value = ''
  editAffinityWeight.value = origWeight.value
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

  return startChanged || endChanged ||
         editNote.value.trim() !== '' ||
         editAffinityWeight.value !== origWeight.value
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
  // y afinidad van deshabilitados, pero por si acaso no se envían cambios suyos.
  if (isFuture.value) {
    if (startDateChanged) payload.targetDate = editStartDate.value
    if (startTimeChanged || startDateChanged) payload.startTime = editStartTime.value
  }
  if (endDateChanged) payload.endDate = editEndDate.value
  if (endTimeChanged || endDateChanged) payload.endTime = editEndTime.value
  if (editNote.value.trim()) payload.note = editNote.value.trim()

  if (isFuture.value && editAffinityWeight.value !== origWeight.value) {
    payload.affinityWeight = editAffinityWeight.value ? parseFloat(editAffinityWeight.value) : null
  }

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
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal wm" :style="{ '--app': appColor || 'var(--primary-500)' }"
      @keydown.enter="save" @keydown.esc="$emit('close')">
      <div class="modal__top"></div>

      <!-- Header: nombre + app, e ID copiable arriba -->
      <div class="modal__head">
        <div class="wm__head-left">
          <button v-if="showBackButton" class="modal__icon-btn" title="Volver al grupo" @click="$emit('back')">
            <i class='bx bx-arrow-back'></i>
          </button>
          <div class="wm__head-text">
            <div class="modal__title">{{ specialistName }}</div>
            <div class="wm__app-line">
              <span class="wm__app-dot"></span>
              <span class="wm__app-name">{{ applicationName }}</span>
              <span class="pill-status" :class="statusPillClass">{{ statusLabel }}</span>
            </div>
          </div>
        </div>
        <div class="modal__head-actions">
          <button class="wm__id-chip" :class="{ 'wm__id-chip--copied': idCopied }"
            :title="idCopied ? 'Copiado' : `Copiar ID\n${window.id}`" @click="copyId(window.id, idCopied)">
            <i class='bx' :class="idCopied ? 'bx-check' : 'bx-hash'"></i>
            <code>{{ idCopied ? 'Copiado' : shortId }}</code>
          </button>
          <button class="modal__x" @click="$emit('close')" title="Cerrar">&times;</button>
        </div>
      </div>

      <!-- Body: formulario directo, estilo Google Calendar -->
      <div class="modal__body wm__body">
        <p v-if="isInShift" class="wm__shift-hint">
          <i class='bx bx-info-circle'></i>
          La ventana está en turno: el inicio quedó sellado, solo puedes ajustar el fin.
        </p>
        <p v-else-if="isEnded" class="wm__shift-hint wm__shift-hint--ended">
          <i class='bx bx-lock-alt'></i>
          Ventana finalizada: el registro quedó sellado y es de solo lectura.
        </p>

        <!-- Horario editable inline -->
        <div class="wm__row">
          <i class='bx bx-time-five'></i>
          <div class="wm__schedule">
            <div class="wm__sched-line">
              <input type="date" v-model="editStartDate" class="wm__input wm__input--date"
                :disabled="!isFuture" title="Fecha de inicio">
              <input type="time" v-model="editStartTime" class="wm__input wm__input--time"
                :disabled="!isFuture" title="Hora de inicio">
              <span class="wm__sched-sep">–</span>
              <input type="time" v-model="editEndTime" class="wm__input wm__input--time"
                :disabled="isEnded" title="Hora de fin">
              <input v-if="crossesDays" type="date" v-model="editEndDate" class="wm__input wm__input--date"
                :disabled="isEnded" title="Fecha de fin">
            </div>
            <div class="wm__sched-meta">
              <span v-if="invalidRange" class="wm__sched-error">
                <i class='bx bx-error-circle'></i> El fin debe ser posterior al inicio
              </span>
              <span v-else-if="durationLabel" class="wm__sched-dur">{{ durationLabel }}</span>
              <button v-if="!crossesDays && !isEnded" class="wm__sched-link" @click="editEndDate = editStartDate"
                type="button" title="Definir una fecha de fin distinta">
                Termina otro día
              </button>
            </div>
          </div>
        </div>

        <!-- Afinidad editable inline -->
        <div class="wm__row">
          <i class='bx bx-slider-alt'></i>
          <label class="wm__row-label" for="wm-affinity">Afinidad</label>
          <input id="wm-affinity" v-model="editAffinityWeight" type="number" step="0.01" min="0.01" max="9.99"
            class="wm__input wm__input--num" placeholder="1" :disabled="!isFuture">
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
      </div>

      <!-- Footer: con cambios → Descartar/Guardar; sin cambios → acciones de la ventana -->
      <div class="modal__foot">
        <template v-if="hasChanged && canEditWindow">
          <button class="mbtn" @click="discard" :disabled="loading">Descartar</button>
          <button class="mbtn mbtn--primary" @click="save" :disabled="loading || invalidRange">
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            Guardar cambios
          </button>
        </template>
        <template v-else>
          <!-- Regla de borrado: selladas (ya iniciaron o pasaron) NO se
               eliminan — solo ventanas futuras. -->
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

<style scoped>
.wm__head-left {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
}

.wm__head-text { min-width: 0; }

/* Línea de app + estado bajo el título */
.wm__app-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 4px;
  min-width: 0;
}

.wm__app-dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  background: var(--app);
  flex-shrink: 0;
}

.wm__app-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* Chip de ID en el header: clic = copiar */
.wm__id-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.66rem;
  cursor: pointer;
  transition: all .15s;
}

.wm__id-chip code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.66rem;
}

.wm__id-chip i { font-size: 0.8rem; }

.wm__id-chip:hover {
  border-color: var(--border);
  color: var(--text);
}

.wm__id-chip--copied {
  border-color: color-mix(in srgb, var(--primary-500) 45%, transparent);
  background: color-mix(in srgb, var(--primary-500) 12%, transparent);
  color: var(--primary-500);
}

.wm__body { gap: 0.55rem; }

/* Fila genérica icono + contenido */
.wm__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  min-height: 34px;
}

.wm__row > i {
  color: var(--muted);
  font-size: 1.1rem;
  width: 1.3rem;
  text-align: center;
  flex-shrink: 0;
}

.wm__row-label {
  font-size: 0.82rem;
  color: var(--muted);
  flex-shrink: 0;
}

/* Inputs "invisibles" estilo Google Calendar: texto plano hasta hover/focus */
.wm__input {
  height: 32px;
  padding: 0 0.5rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  min-width: 0;
  transition: background .12s, border-color .12s;
}

.wm__input:hover:not(:disabled) { background: var(--surface-2); }

.wm__input:focus {
  outline: none;
  background: var(--surface-2);
  border-color: var(--border-strong);
}

.wm__input:disabled {
  color: var(--muted);
  cursor: not-allowed;
  opacity: 0.7;
}

.wm__input--num { width: 80px; }
.wm__input--note { flex: 1; font-weight: 500; }
.wm__input--note::placeholder { color: var(--faint); font-weight: 500; }

/* Bloque de horario */
.wm__schedule {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.wm__sched-line {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}

.wm__sched-sep {
  color: var(--faint);
  font-weight: 600;
  padding: 0 2px;
}

.wm__sched-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-left: 0.5rem;
  min-height: 1rem;
}

.wm__sched-dur {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--faint);
}

.wm__sched-error {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--error-500);
}

.wm__sched-link {
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primary-500);
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s;
}

.wm__row:hover .wm__sched-link,
.wm__sched-link:focus-visible { opacity: 1; }

.wm__sched-link:hover { text-decoration: underline; }

/* Switch de estado */
.wm__switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background .18s, border-color .18s;
}

.wm__switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform .18s cubic-bezier(0.2, 0.9, 0.3, 1.2), background .18s;
}

.wm__switch--on {
  background: var(--primary-500);
  border-color: var(--primary-500);
}

.wm__switch--on .wm__switch-knob {
  transform: translateX(16px);
  background: #fff;
}

.wm__switch:disabled { opacity: 0.5; cursor: not-allowed; }

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

/* Aviso de sellado (en turno / finalizada) */
.wm__shift-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.2rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary-500) 10%, transparent);
  color: var(--primary-600, #1fa672);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.35;
}
.wm__shift-hint i { font-size: 0.95rem; flex-shrink: 0; }

.wm__shift-hint--ended {
  background: var(--surface-2);
  color: var(--muted);
}

/* Fila de ID copiable (herencia, discreta) */
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

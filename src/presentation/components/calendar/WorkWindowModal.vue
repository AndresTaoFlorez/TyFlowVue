<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { fmtForInput, fmtTime12h } from '@/presentation/helpers/formatTime'
import { fmtDateLocale, dateFromTimestamp } from '@/presentation/helpers/formatDate'

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  applicationName: { type: String, default: '—' },
  loading: { type: Boolean, default: false },
  startInEditMode: { type: Boolean, default: false },
  showBackButton: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'toggle', 'delete', 'update', 'back', 'disinherit', 'reinherit'])

const isFuture = computed(() => {
  if (!props.window?.startsAt) return false
  return new Date(props.window.startsAt) > new Date()
})

const isInShift = computed(() => {
  if (!props.window?.startsAt || !props.window?.endsAt) return false
  const now = new Date()
  return new Date(props.window.startsAt) <= now && now <= new Date(props.window.endsAt) && props.window.isActive
})

const isEnded = computed(() => {
  if (!props.window?.endsAt) return false
  return new Date(props.window.endsAt) < new Date()
})

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
  if (isEnded.value) return
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

  // In-shift or ended: starts_at is blocked
  if (!isInShift.value && !isEnded.value) {
    if (startDateChanged) payload.targetDate = editStartDate.value
    if (startTimeChanged || startDateChanged) payload.startTime = editStartTime.value
  }
  if (!isEnded.value) {
    if (endDateChanged) payload.endDate = editEndDate.value
    if (endTimeChanged || endDateChanged) payload.endTime = editEndTime.value
  }
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

  // Start fields only count as changed if editable (not in-shift or ended)
  const startChanged = !isInShift.value && !isEnded.value && (
    editStartDate.value !== origStartDate ||
    editStartTime.value !== fmtForInput(props.window.startTime)
  )
  // End fields only count as changed if not ended
  const endChanged = !isEnded.value && (
    editEndDate.value !== origEndDate ||
    editEndTime.value !== fmtForInput(props.window.endTime)
  )

  return startChanged || endChanged ||
         editNote.value.trim() !== '' ||
         editAffinityWeight.value !== origWeight
})

const fmtDisplay = fmtTime12h

const statusLabel = computed(() => {
  if (isEnded.value) return 'Finalizada'
  return props.window.isActive ? 'Activa' : 'Inactiva'
})
const statusClass = computed(() => {
  if (isEnded.value) return 'ended'
  return props.window.isActive ? 'open' : 'closed'
})
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="wm">
      <!-- Color bar -->
      <div class="wm__bar" :class="'wm__bar--' + statusClass"></div>

      <!-- Header -->
      <div class="wm__header">
        <div class="wm__header-left">
          <button
            v-if="showBackButton"
            class="wm__icon-btn"
            title="Volver al grupo"
            @click="$emit('back')"
          >
            <i class='bx bx-arrow-back'></i>
          </button>
          <span class="wm__status-dot" :class="'wm__status-dot--' + statusClass"></span>
          <span class="wm__status-label">{{ statusLabel }}</span>
        </div>
        <div class="wm__header-right">
          <button
            v-if="!editing && !isEnded"
            class="wm__icon-btn"
            title="Editar horario"
            @click="enterEdit"
          >
            <i class='bx bx-pencil'></i>
          </button>
          <button class="wm__icon-btn" @click="$emit('close')" title="Cerrar">
            <i class='bx bx-x'></i>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="wm__body">
        <!-- Date + Time (view mode) -->
        <template v-if="!editing">
          <div class="wm__row wm__row--date">
            <i class='bx bx-calendar'></i>
            <span>{{ fmtDate(window.scheduledDate) }}</span>
          </div>
          <div class="wm__row wm__row--time">
            <i class='bx bx-time-five'></i>
            <span>{{ fmtDisplay(window.startTime) }} — {{ fmtDisplay(window.endTime) }}</span>
          </div>
        </template>

        <!-- Date + Time (edit mode) -->
        <template v-else>
          <div v-if="isInShift" class="wm__shift-hint">
            <i class='bx bx-info-circle'></i>
            Ventana en turno — solo se puede modificar la hora de fin.
          </div>
          <div v-if="isEnded" class="wm__shift-hint wm__shift-hint--ended">
            <i class='bx bx-info-circle'></i>
            Ventana finalizada — horario no editable.
          </div>
          <div class="wm__edit-row">
            <i class='bx bx-calendar wm__edit-icon'></i>
            <div class="wm__edit-row-fields">
              <label>Inicio</label>
              <div class="wm__edit-row-inputs">
                <input type="date" v-model="editStartDate" class="wm__date-input" :disabled="isInShift || isEnded">
                <input type="time" v-model="editStartTime" class="wm__time-input" :disabled="isInShift || isEnded">
              </div>
            </div>
          </div>
          <div class="wm__edit-row">
            <i class='bx bx-calendar-check wm__edit-icon'></i>
            <div class="wm__edit-row-fields">
              <label>Fin</label>
              <div class="wm__edit-row-inputs">
                <input type="date" v-model="editEndDate" class="wm__date-input" :disabled="isEnded">
                <input type="time" v-model="editEndTime" class="wm__time-input" :disabled="isEnded">
              </div>
            </div>
          </div>
        </template>

        <!-- Note field (edit mode only) -->
        <div v-if="editing" class="wm__edit-note">
          <i class='bx bx-note wm__edit-icon'></i>
          <input
            v-model="editNote"
            type="text"
            class="wm__note-input"
            placeholder="Nota (opcional, ej. turno extendido)"
          >
        </div>

        <!-- Peso de afinidad (edit mode) -->
        <div v-if="editing" class="wm__edit-note">
          <i class='bx bx-slider-alt wm__edit-icon'></i>
          <input
            v-model="editAffinityWeight"
            type="number"
            step="0.01"
            min="0.01"
            max="9.99"
            class="wm__note-input wm__weight-input"
            placeholder="Ej. 1.5"
          >
        </div>

        <!-- Specialist -->
        <div class="wm__row">
          <i class='bx bx-user'></i>
          <span>{{ specialistName }}</span>
        </div>

        <!-- Application -->
        <div class="wm__row">
          <i class='bx bx-cube'></i>
          <span>{{ applicationName }}</span>
        </div>

        <!-- Divider -->
        <div class="wm__divider"></div>

        <!-- Counters -->
        <div class="wm__counters">
          <div class="wm__ctr">
            <span class="wm__ctr-val">{{ window.openingCount }}</span>
            <span class="wm__ctr-lbl">Apertura</span>
          </div>
          <div class="wm__ctr wm__ctr--main">
            <span class="wm__ctr-val">{{ window.currentCount }}</span>
            <span class="wm__ctr-lbl">Actual</span>
          </div>
          <div v-if="window.closingCount != null" class="wm__ctr">
            <span class="wm__ctr-val">{{ window.closingCount }}</span>
            <span class="wm__ctr-lbl">Cierre</span>
          </div>
        </div>

        <!-- Peso de afinidad (view mode) -->
        <div v-if="!editing && window.affinityWeight != null" class="wm__row">
          <i class='bx bx-slider-alt'></i>
          <span>Peso de afinidad: <strong>{{ parseFloat(window.affinityWeight.toFixed(2)) }}</strong></span>
        </div>

        <!-- Inheritance badge -->
        <div v-if="hasInheritance" class="wm__badge wm__badge--active">
          <i class='bx bx-link'></i> Hereda
          <button v-if="canToggleInheritance" class="wm__badge-action" @click="$emit('disinherit', window)" :disabled="loading" title="Desactivar herencia">
            <i class='bx bx-x'></i>
          </button>
        </div>
        <button v-else-if="canToggleInheritance" class="wm__badge wm__badge--toggle" @click="$emit('reinherit', window)" :disabled="loading">
          <i class='bx bx-link'></i> Activar herencia
        </button>

      </div>

      <!-- Footer -->
      <div class="wm__footer">
        <template v-if="editing">
          <button class="wm__btn wm__btn--ghost" @click="cancelEdit" :disabled="loading">Cancelar</button>
          <button class="wm__btn wm__btn--primary" @click="saveEdit" :disabled="loading || !hasChanged">
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            <i v-else class='bx bx-check'></i>
            Guardar
          </button>
        </template>
        <template v-else>
          <button
            class="wm__btn wm__btn--delete"
            :disabled="loading"
            @click="$emit('delete', window)"
            title="Eliminar"
          >
            <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
            <i v-else class='bx bx-trash'></i>
          </button>
          <div v-if="!isEnded" class="wm__footer-right">
            <button
              class="wm__btn"
              :class="window.isActive ? 'wm__btn--danger' : 'wm__btn--primary'"
              :disabled="loading"
              @click="$emit('toggle', window)"
            >
              <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
              <i v-else class='bx' :class="window.isActive ? 'bx-block' : 'bx-check-circle'"></i>
              {{ window.isActive ? 'Inhabilitar' : 'Habilitar' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  padding: 1rem;
  box-sizing: border-box;
}

.wm {
  background: var(--bg-main);
  width: 100%;
  max-width: 400px;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
}

/* ===== Color bar ===== */
.wm__bar {
  height: 4px;
}

.wm__bar--open { background: var(--primary-500); }
.wm__bar--closed { background: var(--border-light); }
.wm__bar--ended { background: #94a3b8; }

/* ===== Header ===== */
.wm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 4px;
  flex-shrink: 0;
}

.wm__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wm__header-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.wm__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wm__status-dot--open { background: var(--primary-500); box-shadow: 0 0 0 3px rgba(42, 199, 143, 0.2); }
.wm__status-dot--closed { background: #94a3b8; }
.wm__status-dot--ended { background: #cbd5e1; }

.wm__status-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.wm__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 18px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.wm__icon-btn:hover { background: var(--bg-card); color: var(--text-primary); }

/* ===== Body ===== */
.wm__body {
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  -webkit-overflow-scrolling: touch;
}

/* Row items */
.wm__row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-primary);
  padding: 4px 0;
}

.wm__row i {
  font-size: 16px;
  color: var(--text-secondary);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.wm__row--date {
  font-weight: 600;
  font-size: 14px;
}

.wm__row--time {
  font-size: 14px;
  font-weight: 500;
}

/* ===== Edit row (date + time) ===== */
.wm__edit-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.wm__edit-icon {
  font-size: 16px;
  color: var(--text-secondary);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  margin-top: 18px;
}

.wm__edit-row-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wm__edit-row-fields label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.wm__edit-row-inputs {
  display: flex;
  gap: 6px;
}

.wm__date-input,
.wm__time-input {
  padding: 6px 8px;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
  transition: border-color 0.15s;
}

.wm__date-input { flex: 1.4; min-width: 0; }
.wm__time-input { flex: 1; min-width: 0; }

.wm__date-input:focus,
.wm__time-input:focus { border-color: var(--primary-500); }

.wm__date-input:disabled,
.wm__time-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--bg-card);
}

.wm__shift-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  color: #0369a1;
  background: #e0f2fe;
}

.wm__shift-hint--ended {
  color: var(--text-secondary);
  background: var(--bg-card);
}

/* ===== Note input ===== */
.wm__edit-note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.wm__note-input {
  flex: 1;
  padding: 6px 8px;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
  transition: border-color 0.15s;
}

.wm__note-input:focus { border-color: var(--primary-500); }

.wm__note-input::placeholder { color: #94a3b8; }

.wm__weight-input { max-width: 180px; }

/* ===== Divider ===== */
.wm__divider {
  height: 1px;
  background: var(--border-light);
  margin: 4px 0;
}

/* ===== Counters ===== */
.wm__counters {
  display: flex;
  gap: 0;
  padding: 4px 0;
}

.wm__ctr {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  border-right: 1px solid var(--border-light);
}

.wm__ctr:last-child { border-right: none; }

.wm__ctr-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-secondary);
}

.wm__ctr--main .wm__ctr-val {
  color: var(--primary-500);
  font-size: 22px;
}

.wm__ctr-lbl {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* ===== Badge ===== */
.wm__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  width: fit-content;
  border: none;
}

.wm__badge--active {
  color: #0891b2;
  background: #ecfeff;
}

.wm__badge--toggle {
  color: var(--text-secondary);
  background: var(--bg-card, #f1f5f9);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.wm__badge--toggle:hover:not(:disabled) {
  color: #0891b2;
  background: #ecfeff;
}

.wm__badge--toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wm__badge-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  margin-left: 2px;
  transition: background 0.15s;
}

.wm__badge-action:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.2);
}

.wm__badge-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== Footer ===== */
.wm__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  background: #fafafa;
  flex-shrink: 0;
}

.wm__footer-right {
  display: flex;
  gap: 8px;
}

/* ===== Buttons ===== */
.wm__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}

.wm__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.wm__btn--primary {
  background: var(--primary-500);
  color: white;
}
.wm__btn--primary:hover:not(:disabled) { background: var(--primary-600); }

.wm__btn--danger {
  background: var(--error-500);
  color: white;
}
.wm__btn--danger:hover:not(:disabled) { background: #DC2626; }

.wm__btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}
.wm__btn--ghost:hover:not(:disabled) { background: var(--bg-card); color: var(--text-primary); }

.wm__btn--delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 16px;
}
.wm__btn--delete:hover:not(:disabled) {
  color: var(--error-500);
  border-color: var(--error-500);
  background: var(--error-bg);
}

@media (max-width: 480px) {
  .wm {
    max-width: calc(100% - 2rem);
    border-radius: var(--radius-md);
  }
}
</style>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  applicationName: { type: String, default: '—' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'open', 'close-session', 'delete', 'update'])

// ---- Edit mode ----
const editing = ref(false)
const editStart = ref('')
const editEnd = ref('')
const editNote = ref('')

function enterEdit() {
  editStart.value = fmtForInput(props.window.startTime)
  editEnd.value = fmtForInput(props.window.endTime)
  editNote.value = ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function saveEdit() {
  const payload = {}
  const origStart = fmtForInput(props.window.startTime)
  const origEnd = fmtForInput(props.window.endTime)
  if (editStart.value !== origStart) payload.startTime = editStart.value
  if (editEnd.value !== origEnd) payload.endTime = editEnd.value
  if (editNote.value.trim()) payload.note = editNote.value.trim()
  if (Object.keys(payload).length === 0) {
    editing.value = false
    return
  }
  emit('update', props.window, payload)
}

// Reset edit mode when window changes or modal closes
watch(() => props.window?.id, () => { editing.value = false })
watch(() => props.loading, (val) => { if (!val && editing.value) editing.value = false })

const hasTimeChanged = computed(() => {
  if (!editing.value) return false
  return editStart.value !== fmtForInput(props.window.startTime) ||
         editEnd.value !== fmtForInput(props.window.endTime) ||
         editNote.value.trim() !== ''
})

// ---- Formatting helpers ----
function fmtForInput(time) {
  if (!time) return '08:00'
  const parts = time.split(':')
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

function fmtDisplay(time) {
  if (!time) return '?'
  const parts = time.split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1]
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${ampm}`
}

function fmtDate(date) {
  if (!date) return '—'
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const statusLabel = computed(() => props.window.isSessionOpen ? 'Abierta' : 'Cerrada')
const statusClass = computed(() => props.window.isSessionOpen ? 'open' : 'closed')
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="wm">
      <!-- Color bar -->
      <div class="wm__bar" :class="'wm__bar--' + statusClass"></div>

      <!-- Header -->
      <div class="wm__header">
        <div class="wm__header-left">
          <span class="wm__status-dot" :class="'wm__status-dot--' + statusClass"></span>
          <span class="wm__status-label">{{ statusLabel }}</span>
        </div>
        <div class="wm__header-right">
          <button
            v-if="!editing"
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
        <!-- Date -->
        <div class="wm__row wm__row--date">
          <i class='bx bx-calendar'></i>
          <span>{{ fmtDate(window.scheduledDate) }}</span>
        </div>

        <!-- Time (view or edit) -->
        <div v-if="!editing" class="wm__row wm__row--time">
          <i class='bx bx-time-five'></i>
          <span>{{ fmtDisplay(window.startTime) }} — {{ fmtDisplay(window.endTime) }}</span>
        </div>
        <div v-else class="wm__edit-times">
          <i class='bx bx-time-five wm__edit-icon'></i>
          <div class="wm__time-inputs">
            <div class="wm__time-field">
              <label>Inicio</label>
              <input type="time" v-model="editStart" class="wm__time-input">
            </div>
            <span class="wm__time-sep">—</span>
            <div class="wm__time-field">
              <label>Fin</label>
              <input type="time" v-model="editEnd" class="wm__time-input">
            </div>
          </div>
        </div>

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

        <!-- Inheritance badge -->
        <div v-if="window.inheritsOnReopen" class="wm__badge">
          <i class='bx bx-transfer'></i> Hereda conteo al reabrir
        </div>
      </div>

      <!-- Footer -->
      <div class="wm__footer">
        <template v-if="editing">
          <button class="wm__btn wm__btn--ghost" @click="cancelEdit" :disabled="loading">Cancelar</button>
          <button class="wm__btn wm__btn--primary" @click="saveEdit" :disabled="loading || !hasTimeChanged">
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
          <div class="wm__footer-right">
            <button
              v-if="!window.isSessionOpen && window.isActive"
              class="wm__btn wm__btn--primary"
              :disabled="loading"
              @click="$emit('open', window)"
            >
              <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
              <i v-else class='bx bx-play'></i>
              Abrir sesión
            </button>
            <button
              v-if="window.isSessionOpen"
              class="wm__btn wm__btn--danger"
              :disabled="loading"
              @click="$emit('close-session', window)"
            >
              <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
              <i v-else class='bx bx-stop'></i>
              Cerrar sesión
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
}

.wm {
  background: var(--bg-main);
  width: 100%;
  max-width: 400px;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

/* ===== Color bar ===== */
.wm__bar {
  height: 4px;
}

.wm__bar--open { background: var(--primary-500); }
.wm__bar--closed { background: var(--border-light); }

/* ===== Header ===== */
.wm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 4px;
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

/* ===== Edit time fields ===== */
.wm__edit-times {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.wm__edit-icon {
  font-size: 16px;
  color: var(--text-secondary);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.wm__time-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.wm__time-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.wm__time-field label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.wm__time-input {
  padding: 6px 8px;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}

.wm__time-input:focus { border-color: var(--primary-500); }

.wm__time-sep {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 14px;
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
  color: #4F46E5;
  background: #EEF2FF;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  width: fit-content;
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
</style>

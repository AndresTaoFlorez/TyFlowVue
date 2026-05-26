<script setup>
import { ref } from 'vue'

const props = defineProps({
  window: { type: Object, required: true },
  specialistName: { type: String, default: '—' },
  applicationName: { type: String, default: '—' },
})

const emit = defineEmits(['close', 'open', 'closeSession', 'delete'])

const accionando = ref(false)

const handleOpen = async () => {
  accionando.value = true
  try {
    await emit('open', props.window)
  } finally {
    accionando.value = false
  }
}

const handleClose = async () => {
  accionando.value = true
  try {
    await emit('closeSession', props.window)
  } finally {
    accionando.value = false
  }
}

const handleDelete = async () => {
  accionando.value = true
  try {
    await emit('delete', props.window)
  } finally {
    accionando.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="ww-modal">
      <div class="ww-modal__header">
        <h3>Detalle de Ventana</h3>
        <button @click="$emit('close')" class="ww-modal__close"><i class='bx bx-x'></i></button>
      </div>

      <div class="ww-modal__body">
        <!-- Status -->
        <div class="ww-modal__status" :class="window.isSessionOpen ? 'ww-modal__status--open' : 'ww-modal__status--closed'">
          <i :class="window.isSessionOpen ? 'bx bx-radio-circle-marked' : 'bx bx-radio-circle'"></i>
          {{ window.isSessionOpen ? 'Sesión abierta' : 'Sesión cerrada' }}
        </div>

        <!-- Info grid -->
        <div class="ww-modal__grid">
          <div class="ww-modal__field">
            <span class="ww-modal__label">Especialista</span>
            <span class="ww-modal__value">{{ specialistName }}</span>
          </div>
          <div class="ww-modal__field">
            <span class="ww-modal__label">Aplicación</span>
            <span class="ww-modal__value">{{ applicationName }}</span>
          </div>
          <div class="ww-modal__field">
            <span class="ww-modal__label">Horario</span>
            <span class="ww-modal__value">{{ window.timeRange }}</span>
          </div>
          <div class="ww-modal__field">
            <span class="ww-modal__label">ID</span>
            <span class="ww-modal__value ww-modal__value--mono">{{ window.id }}</span>
          </div>
        </div>

        <!-- Counters -->
        <div class="ww-modal__counters">
          <div class="ww-modal__counter">
            <span class="ww-modal__counter-value">{{ window.openingCount }}</span>
            <span class="ww-modal__counter-label">Al abrir</span>
          </div>
          <div class="ww-modal__counter">
            <span class="ww-modal__counter-value ww-modal__counter-value--main">{{ window.currentCount }}</span>
            <span class="ww-modal__counter-label">Actual</span>
          </div>
          <div v-if="window.closingCount != null" class="ww-modal__counter">
            <span class="ww-modal__counter-value">{{ window.closingCount }}</span>
            <span class="ww-modal__counter-label">Al cerrar</span>
          </div>
        </div>

        <!-- Inheritance -->
        <div v-if="window.inheritsOnReopen" class="ww-modal__badge">
          <i class='bx bx-transfer'></i> Hereda conteo al reabrir
        </div>
      </div>

      <div class="ww-modal__actions">
        <button
          class="btn-delete"
          :disabled="accionando"
          @click="handleDelete"
          title="Eliminar ventana"
        >
          <i v-if="accionando" class='bx bx-loader-alt bx-spin'></i>
          <i v-else class='bx bx-trash'></i>
        </button>
        <div class="ww-modal__actions-right">
          <button
            v-if="!window.isSessionOpen && window.isActive"
            class="btn-primary"
            :disabled="accionando"
            @click="handleOpen"
          >
            <i v-if="accionando" class='bx bx-loader-alt bx-spin'></i>
            <i v-else class='bx bx-play'></i>
            Abrir sesión
          </button>
          <button
            v-if="window.isSessionOpen"
            class="btn-danger"
            :disabled="accionando"
            @click="handleClose"
          >
            <i v-if="accionando" class='bx bx-loader-alt bx-spin'></i>
            <i v-else class='bx bx-stop'></i>
            Cerrar sesión
          </button>
          <button class="btn-secondary" @click="$emit('close')">Listo</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.ww-modal {
  background: white;
  width: 100%;
  max-width: 420px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.ww-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.ww-modal__header h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.ww-modal__close {
  background: none;
  border: none;
  font-size: 1.4rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.ww-modal__body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Status */
.ww-modal__status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-full);
  width: fit-content;
}

.ww-modal__status--open {
  background: #dcfce7;
  color: #15803d;
}

.ww-modal__status--closed {
  background: #f1f5f9;
  color: #64748b;
}

/* Grid */
.ww-modal__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.ww-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.ww-modal__label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.ww-modal__value {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.ww-modal__value--mono {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Counters */
.ww-modal__counters {
  display: flex;
  gap: 1.5rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
}

.ww-modal__counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.ww-modal__counter-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.ww-modal__counter-value--main {
  color: var(--primary-500);
  font-size: 1.5rem;
}

.ww-modal__counter-label {
  font-size: 0.68rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

/* Badge */
.ww-modal__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #4F46E5;
  background: #E0E7FF;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-full);
  width: fit-content;
}

/* Actions */
.ww-modal__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  background: #fafafa;
}

.ww-modal__actions-right {
  display: flex;
  gap: 0.6rem;
}

.btn-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  background: none;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete:hover:not(:disabled) {
  color: var(--error-500);
  border-color: var(--error-500);
  background: var(--error-bg);
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.5rem 0.9rem;
  background: var(--error-500);
  color: white;
  font-weight: 600;
  font-size: 0.82rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-danger:hover:not(:disabled) {
  background: #DC2626;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

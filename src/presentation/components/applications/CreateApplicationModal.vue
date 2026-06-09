<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close', 'create'])

const nombre = ref('')

watch(() => props.visible, (val) => {
  if (val) nombre.value = ''
})

const handleSubmit = () => {
  const name = nombre.value.trim()
  if (!name) return
  emit('create', name)
}

const handleClose = () => {
  nombre.value = ''
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Nueva Aplicación</h2>
        <button @click="handleClose" class="btn-close" :disabled="creating"><i class='bx bx-x'></i></button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-form">
        <div class="form-group">
          <label>Nombre de la aplicación *</label>
          <input
            v-model="nombre"
            type="text"
            class="form-input"
            :class="{ 'input-error': error }"
            placeholder="Ej: Portal de Clientes"
            :disabled="creating"
            required
          >
          <span v-if="error" class="error-text">{{ error }}</span>
        </div>

        <div class="modal-actions">
          <button type="button" @click="handleClose" class="btn-secondary" :disabled="creating">Cancelar</button>
          <button type="submit" class="btn-primary" :class="{ 'btn-primary--loading': creating }" :disabled="creating || !nombre.trim()">
            <i v-if="creating" class='bx bx-loader-alt bx-spin'></i>
            {{ creating ? 'Creando...' : 'Crear Aplicación' }}
          </button>
        </div>
      </form>
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

.modal-content {
  background: var(--bg-main); width: 100%; max-width: 420px;
  border-radius: var(--radius-lg); padding: 1.75rem;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;
}

.modal-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-close {
  background: transparent; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer;
}

.modal-form {
  display: flex; flex-direction: column; gap: 1rem;
}

.form-group label {
  font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3rem; display: block;
}

.form-input {
  width: 100%; padding: 0.8rem; border: 1px solid var(--border-light); border-radius: var(--radius-md);
}

.form-input:focus {
  outline: none; border-color: var(--primary-500);
}

.form-input:disabled {
  background-color: var(--bg-card); color: var(--text-secondary); cursor: not-allowed; opacity: 0.7;
}

.input-error {
  border-color: var(--error-500) !important;
  background-color: #FEF2F2;
}

.error-text {
  color: var(--error-500); font-size: 0.75rem; font-weight: 500; margin-top: 0.3rem; display: block;
}

.modal-actions {
  display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;
}
</style>

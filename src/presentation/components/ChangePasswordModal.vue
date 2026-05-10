<script setup>
import { ref } from 'vue'
import { changePasswordUseCase } from '@/application/use-cases/auth/ChangePasswordUseCase'

const emit = defineEmits(['close'])

const newPassword = ref('')
const confirmPassword = ref('')
const errores = ref({})
const successMessage = ref('')
const cargando = ref(false)

const validar = () => {
  errores.value = {}
  let valido = true

  if (newPassword.value.length < 6) {
    errores.value.newPassword = 'La contrasena debe tener al menos 6 caracteres.'
    valido = false
  }

  if (newPassword.value !== confirmPassword.value) {
    errores.value.confirmPassword = 'Las contrasenas no coinciden.'
    valido = false
  }

  return valido
}

const handleSubmit = async () => {
  if (!validar()) return

  cargando.value = true
  successMessage.value = ''

  try {
    const message = await changePasswordUseCase(newPassword.value)
    successMessage.value = message || 'Contrasena actualizada correctamente.'
    newPassword.value = ''
    confirmPassword.value = ''

    setTimeout(() => emit('close'), 1500)
  } catch (error) {
    errores.value.general = error.message || 'Error al cambiar la contrasena.'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Cambiar Contrasena</h2>
        <button @click="emit('close')" class="btn-close">
          <i class='bx bx-x'></i>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-form">
        <div class="form-group">
          <label>Nueva Contrasena *</label>
          <input
            v-model="newPassword"
            type="password"
            required
            minlength="6"
            class="form-input"
            :class="{ 'input-error': errores.newPassword }"
            placeholder="Minimo 6 caracteres"
          >
          <span v-if="errores.newPassword" class="error-text">{{ errores.newPassword }}</span>
        </div>

        <div class="form-group">
          <label>Confirmar Contrasena *</label>
          <input
            v-model="confirmPassword"
            type="password"
            required
            class="form-input"
            :class="{ 'input-error': errores.confirmPassword }"
            placeholder="Repite la contrasena"
          >
          <span v-if="errores.confirmPassword" class="error-text">{{ errores.confirmPassword }}</span>
        </div>

        <p v-if="errores.general" class="error-general">{{ errores.general }}</p>
        <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

        <div class="modal-actions">
          <button type="button" @click="emit('close')" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="cargando">
            {{ cargando ? 'Guardando...' : 'Cambiar Contrasena' }}
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
  border-radius: var(--radius-lg); padding: 2rem;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-close {
  font-size: 1.5rem; color: var(--text-secondary);
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

.input-error {
  border-color: var(--error-500) !important;
  background-color: #FEF2F2;
}

.error-text {
  color: var(--error-500);
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.3rem;
  display: block;
}

.error-general {
  color: var(--error-500);
  font-weight: 600;
  text-align: center;
}

.success-message {
  color: var(--success-text);
  background-color: var(--success-bg);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-md);
  text-align: center;
  font-weight: 600;
}

.modal-actions {
  display: flex; justify-content: flex-end; gap: 1rem; margin-top: 0.5rem;
}
</style>

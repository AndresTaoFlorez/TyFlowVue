<script setup>
import { ref } from 'vue'
import { recoverPasswordUseCase } from '@/application/use-cases/auth/RecoverPasswordUseCase'
import LoginBanner from '@/presentation/components/layout/LoginBanner.vue'

const email = ref('')
const successMessage = ref('')
const errorMessage = ref('')
const cargando = ref(false)

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  cargando.value = true

  try {
    await recoverPasswordUseCase(email.value)
    successMessage.value = 'Si el correo existe, se envio un enlace de recuperacion a tu bandeja.'
    email.value = ''
  } catch (error) {
    errorMessage.value = error.message || 'Error al enviar el correo de recuperacion.'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-card">

      <LoginBanner />

      <div class="auth-form">
        <h1 class="auth-form__title">Recuperar Contrasena</h1>
        <p class="auth-form__desc">Ingresa tu correo electronico y te enviaremos un enlace para restablecer tu contrasena.</p>

        <form @submit.prevent="handleSubmit" class="auth-form__body">
          <div class="form-group">
            <label for="email">Correo Electronico</label>
            <input
              v-model="email"
              type="email"
              id="email"
              placeholder="correo@ejemplo.com"
              required
            >
          </div>

          <Transition name="error-fade">
            <div v-if="errorMessage" class="auth-alert auth-alert--error">
              <i class='bx bx-error-circle'></i>
              <span>{{ errorMessage }}</span>
            </div>
          </Transition>

          <Transition name="error-fade">
            <div v-if="successMessage" class="auth-alert auth-alert--success">
              <i class='bx bx-check-circle'></i>
              <span>{{ successMessage }}</span>
            </div>
          </Transition>

          <button type="submit" class="auth-btn" :disabled="cargando">
            <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
            {{ cargando ? 'Enviando...' : 'Enviar Enlace' }}
          </button>
        </form>

        <div class="auth-footer">
          <RouterLink to="/" class="auth-link">Volver al inicio de sesion</RouterLink>
        </div>
      </div>

    </div>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-main);
  padding: 1rem;
}

.auth-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  max-width: 900px;
  background-color: var(--bg-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.auth-form {
  display: flex;
  flex-direction: column;
  padding: 3rem;
  justify-content: center;
}

.auth-form__title {
  text-align: center;
  color: var(--primary-500);
  margin-bottom: 0.75rem;
  font-size: 1.8rem;
}

.auth-form__desc {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  line-height: 1.5;
}

.auth-form__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-weight: 600;
  color: var(--text-main);
  font-size: 0.9rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 1rem;
  background: var(--bg-main);
  color: var(--text-main);
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-500);
}

/* Alert */
.auth-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  border-left: 3px solid;
}

.auth-alert--error {
  background-color: var(--error-bg);
  color: var(--error-text);
  border-left-color: var(--error-500);
}

.auth-alert--success {
  background-color: var(--success-bg);
  color: var(--success-text);
  border-left-color: #10B981;
}

.auth-alert i {
  font-size: 1.2rem;
  flex-shrink: 0;
}

/* Submit button */
.auth-btn {
  padding: 0.85rem;
  margin-top: 0.5rem;
  background-color: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  transition: background 0.2s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.auth-btn:hover:not(:disabled) {
  background-color: var(--primary-600);
}

.auth-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Footer */
.auth-footer {
  margin-top: 1.5rem;
  text-align: center;
}

.auth-link {
  color: var(--primary-500);
  font-weight: 600;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.auth-link:hover {
  text-decoration: underline;
  color: var(--primary-600);
}

/* Transitions */
.error-fade-enter-active { animation: slideDown 0.25s ease-out; }
.error-fade-leave-active { animation: slideDown 0.2s ease-in reverse; }

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mobile */
@media (max-width: 768px) {
  .auth-page {
    padding: 0;
    align-items: stretch;
  }

  .auth-card {
    grid-template-columns: 1fr;
    border-radius: 0;
    min-height: 100vh;
    min-height: 100dvh;
    box-shadow: none;
  }

  .auth-form {
    padding: 2rem 1.5rem;
    order: 2;
  }

  .auth-form__title {
    font-size: 1.5rem;
  }

  .auth-form__desc {
    font-size: 0.85rem;
  }

  .form-group input {
    padding: 0.85rem;
    font-size: 16px;
  }

  .auth-btn {
    margin-top: 1rem;
    padding: 1rem;
    font-size: 1.05rem;
  }
}

@media (max-width: 390px) {
  .auth-form {
    padding: 1.5rem 1rem;
  }

  .auth-form__title {
    font-size: 1.35rem;
  }
}
</style>

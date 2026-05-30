<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'
import { checkEmailUseCase } from '@/application/use-cases/auth/CheckEmailUseCase'
import LoginBanner from '@/presentation/components/LoginBanner.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')
const cargando = ref(false)
const emailExiste = ref(false)

const handleSubmit = async () => {
  errorMessage.value = ''
  emailExiste.value = false
  cargando.value = true

  try {
    await authStore.login(email.value, password.value)
    router.push({ name: 'dashboard' })
  } catch (error) {
    // Si es usuario inactivo (UserInactiveError del store o 403 del guard del backend)
    if (error.name === 'UserInactiveError' || error.isForbidden) {
      errorMessage.value = 'Tu cuenta esta inactiva. Contacta al soporte.'
      return
    }

    // Error de red (backend no disponible, sin conexión, timeout)
    if (error.isNetworkError || error.isServerError) {
      errorMessage.value = error.userMessage
      return
    }

    // Login falló (401) → verificar si el correo existe
    let exists = false
    try { exists = await checkEmailUseCase(email.value.trim()) } catch {}
    emailExiste.value = exists

    if (exists) {
      errorMessage.value = 'La contrasena es incorrecta.'
    } else {
      errorMessage.value = 'No se encontro una cuenta con este correo.'
    }
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
        <h1 class="auth-form__title">Autenticacion</h1>

        <form @submit.prevent="handleSubmit" class="auth-form__body">
          <div class="form-group">
            <label for="email">Usuario</label>
            <input
              v-model="email"
              type="email"
              id="email"
              placeholder="correo@ejemplo.com"
              required
            >
          </div>

          <div class="form-group">
            <label for="password">Contrasena</label>
            <div class="input-wrap">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                id="password"
                placeholder="••••••••"
                required
              >
              <button
                type="button"
                class="input-wrap__toggle"
                @click="showPassword = !showPassword"
                tabindex="-1"
              >
                <i :class="['bx', showPassword ? 'bx-hide' : 'bx-show']"></i>
              </button>
            </div>
          </div>

          <Transition name="error-fade">
            <div v-if="errorMessage" class="auth-alert auth-alert--error">
              <i class='bx bx-error-circle'></i>
              <span>{{ errorMessage }}</span>
            </div>
          </Transition>

          <button type="submit" class="auth-btn" :disabled="cargando">
            <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
            {{ cargando ? 'Ingresando...' : 'Iniciar Sesion' }}
          </button>
        </form>

        <div v-if="emailExiste" class="auth-footer">
          <RouterLink to="/forgot-password" class="auth-link">¿Olvidaste tu contrasena?</RouterLink>
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
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
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

/* Password toggle wrapper */
.input-wrap {
  position: relative;
}

.input-wrap input {
  padding-right: 2.75rem;
}

.input-wrap__toggle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1.2rem;
  transition: color 0.2s;
}

.input-wrap__toggle:hover {
  color: var(--primary-500);
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
    margin-bottom: 1.25rem;
  }

  .form-group input {
    padding: 0.85rem;
    font-size: 16px; /* iOS zoom prevention */
  }

  .auth-btn {
    margin-top: 0.5rem;
    padding: 0.75rem;
    font-size: 0.95rem;
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

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
    // Si es usuario inactivo, mostrar ese mensaje directamente
    if (error.name === 'UserInactiveError') {
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
  <main class="login-page">
    <div class="login-card">

      <LoginBanner />

      <div class="login-card__form">
        <h1>Autenticacion</h1>
        <form @submit.prevent="handleSubmit" id="loginForm">

          <label for="email">Usuario
            <input v-model="email" type="email" id="email" placeholder="correo@ejemplo.com" required>
          </label>

          <label for="password">
            Contrasena
            <input v-model="password" type="password" id="password" placeholder="••••••••" required>
          </label>

          <Transition name="error-fade">
            <div v-if="errorMessage" class="login-error">
              <i class='bx bx-error-circle'></i>
              <span>{{ errorMessage }}</span>
            </div>
          </Transition>

          <button type="submit" class="btn-submit" :disabled="cargando">
            <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
            {{ cargando ? 'Ingresando...' : 'Iniciar Sesion' }}
          </button>
        </form>

        <div v-if="emailExiste" class="form-footer">
          <RouterLink to="/forgot-password" class="form-link">¿Olvidaste tu contrasena?</RouterLink>
        </div>
      </div>

    </div>
  </main>
</template>

<style scoped>
.login-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--error-bg);
  color: var(--error-text);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  border-left: 3px solid var(--error-500);
}

.login-error i {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.error-fade-enter-active { animation: slideDown 0.25s ease-out; }
.error-fade-leave-active { animation: slideDown 0.2s ease-in reverse; }

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-main);
  padding: 1rem;
}

.login-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  max-width: 900px;
  background-color: var(--bg-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.login-card__form {
  display: flex;
  flex-direction: column;
  padding: 3rem;
  justify-content: center;

  #loginForm {
    display: inherit;
    flex-direction: inherit;
    gap: 1rem;

    label {
      display: inherit;
      flex-direction: inherit;
      gap: 0.5rem;
      margin: 0;
    }
  }
}

.login-card__form h1 {
  text-align: center;
  color: var(--primary-500);
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
}

.login-card__form label {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-main);
}

.login-card__form input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: var(--radius-md);
  font-size: 1rem;
}

.btn-submit {
  padding: 15px;
  margin-top: 1rem;
  background-color: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: bold;
  font-size: 1rem;
  transition: background 0.3s;
}

.btn-submit:hover {
  background-color: var(--primary-600);
}

@media (max-width: 768px) {
  .login-page {
    padding: 0;
    align-items: flex-start;
  }

  .login-card {
    grid-template-columns: 1fr;
    border-radius: 0;
    min-height: 100vh;
    box-shadow: none;
  }

  .login-card__form {
    padding: 2rem;
    order: 2;

    #loginForm {
      gap: 0.8rem;

      label {
        gap: 0.25rem;
      }
    }
  }

  .login-card__form h1 {
    font-size: 1.5rem;
  }

  .login-card__form input {
    padding: 14px;
    font-size: 16px;
  }

  .btn-submit {
    margin-top: 1.5rem;
    padding: 18px;
    width: 100%;
    display: block;
    font-size: 1.1rem;
  }


}

.form-footer {
  margin-top: 1.5rem;
  text-align: center;
}

.form-link {
  color: var(--primary-500);
  font-weight: 600;
  font-size: 0.9rem;
}

.form-link:hover {
  text-decoration: underline;
}
</style>

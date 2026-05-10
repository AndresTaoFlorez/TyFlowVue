<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'

const router = useRouter()

const ERROR_MESSAGES = {
  'Invalid login credentials': 'El correo o la contrasena son incorrectos.',
  'Email not confirmed': 'Debes confirmar tu correo electronico antes de entrar.',
  'User not found': 'No existe un usuario con ese correo.',
  'Password is too short': 'La contrasena debe tener al menos 6 caracteres.',
  'Network error': 'Hubo un problema de conexion. Revisa tu internet.',
  'UserInactiveError': 'Tu cuenta esta inactiva. Contacta al soporte.',
}

const email = ref('')
const password = ref('')
const authStore = useAuthStore()
const errorMessage = ref('')
const cargando = ref(false)

const handleSubmit = async () => {
  errorMessage.value = ''
  cargando.value = true

  try {
    await authStore.login(email.value, password.value)
    router.push({ name: 'dashboard' })
  } catch (error) {
    const key = error.name === 'UserInactiveError' ? error.name : error.message
    errorMessage.value = ERROR_MESSAGES[key] || error.message || 'Ocurrio un error inesperado. Intentalo de nuevo.'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <div class="login-card">

      <div class="login-card__banner">
        <h3>TYFLOW</h3>
        <p>Gestiona y optimiza tu reparto de manera eficiente.</p>
      </div>

      <div class="login-card__form">
        <h1>Autenticacion</h1>
        <form @submit.prevent="handleSubmit" id="loginForm">
          <label for="email">Usuario</label>
          <input
            v-model="email"
            type="email"
            id="email"
            placeholder="correo@ejemplo.com"
            required
          >

          <label for="password">Contrasena</label>
          <input
            v-model="password"
            type="password"
            id="password"
            placeholder="••••••••"
            required
          >

          <p v-if="errorMessage" id="msg" class="errorMessage">{{ errorMessage }}</p>
          <button type="submit" class="btn-submit" :disabled="cargando">
            {{ cargando ? 'Ingresando...' : 'Iniciar Sesion' }}
          </button>
        </form>

        <div class="form-footer">
          <RouterLink to="/forgot-password" class="form-link">¿Olvidaste tu contrasena?</RouterLink>
        </div>
      </div>

    </div>
  </main>
</template>

<style scoped>
.errorMessage {
  color: var(--error-500);
  margin-top: 1rem;
  text-align: center;
  font-weight: bold;
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
  margin-top: 2rem;
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

.login-card__banner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--primary-gradient);
  padding: 60px;
  color: white;
  text-align: center;
}

.login-card__banner h3 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
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

  .login-card__banner {
    padding: 40px 20px;
    order: 1;
  }

  .login-card__banner h3 { font-size: 2rem; }
  .login-card__banner p { font-size: 0.9rem; }

  .login-card__form {
    padding: 2rem;
    order: 2;
  }

  .login-card__form h1 { font-size: 1.5rem; }

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

  #loginForm {
    display: flex;
    flex-direction: column;
    width: 100%;
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

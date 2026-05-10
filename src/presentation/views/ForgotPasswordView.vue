<script setup>
import { ref } from 'vue'
import { recoverPasswordUseCase } from '@/application/use-cases/auth/RecoverPasswordUseCase'

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
  <main class="login-page">
    <div class="login-card login-card--narrow">

      <div class="login-card__banner">
        <h3>TYFLOW</h3>
        <p>Recupera el acceso a tu cuenta.</p>
      </div>

      <div class="login-card__form">
        <h1>Recuperar Contrasena</h1>
        <p class="form-description">Ingresa tu correo electronico y te enviaremos un enlace para restablecer tu contrasena.</p>

        <form @submit.prevent="handleSubmit">
          <label for="email">Correo Electronico</label>
          <input
            v-model="email"
            type="email"
            id="email"
            placeholder="correo@ejemplo.com"
            required
          >

          <p v-if="errorMessage" class="errorMessage">{{ errorMessage }}</p>
          <p v-if="successMessage" class="successMessage">{{ successMessage }}</p>

          <button type="submit" class="btn-submit" :disabled="cargando">
            {{ cargando ? 'Enviando...' : 'Enviar Enlace' }}
          </button>
        </form>

        <div class="form-footer">
          <RouterLink to="/" class="form-link">Volver al inicio de sesion</RouterLink>
        </div>
      </div>

    </div>
  </main>
</template>

<style scoped>
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
  margin-bottom: 0.75rem;
  font-size: 1.8rem;
}

.form-description {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  line-height: 1.4;
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
  width: 100%;
  background-color: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: bold;
  font-size: 1rem;
  transition: background 0.3s;
}

.btn-submit:hover:not(:disabled) {
  background-color: var(--primary-600);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.errorMessage {
  color: var(--error-500);
  margin-top: 1rem;
  text-align: center;
  font-weight: bold;
}

.successMessage {
  color: var(--success-text);
  background-color: var(--success-bg);
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  text-align: center;
  font-weight: 600;
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

@media (max-width: 768px) {
  .login-page { padding: 0; align-items: flex-start; }
  .login-card {
    grid-template-columns: 1fr;
    border-radius: 0;
    min-height: 100vh;
    box-shadow: none;
  }
  .login-card__banner { padding: 40px 20px; order: 1; }
  .login-card__banner h3 { font-size: 2rem; }
  .login-card__form { padding: 2rem; order: 2; }
  .login-card__form h1 { font-size: 1.5rem; }
  .login-card__form input { padding: 14px; font-size: 16px; }
  .btn-submit { margin-top: 1.5rem; padding: 18px; font-size: 1.1rem; }
}
</style>

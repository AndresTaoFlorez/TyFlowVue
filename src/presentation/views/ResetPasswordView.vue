<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { changePasswordUseCase } from '@/application/use-cases/auth/ChangePasswordUseCase'
import { TOKEN_KEY } from '@/infrastructure/http/client'

const router = useRouter()

const newPassword = ref('')
const confirmPassword = ref('')
const errores = ref({})
const successMessage = ref('')
const errorMessage = ref('')
const cargando = ref(false)
const tokenValid = ref(false)

onMounted(() => {
  // Extract access_token from URL hash fragment
  // Format: #access_token=xxx&type=recovery&...
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  const token = params.get('access_token')

  if (token) {
    // Temporarily store the token so the HTTP client interceptor picks it up
    localStorage.setItem(TOKEN_KEY, token)
    tokenValid.value = true
  }
})

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
  errorMessage.value = ''

  try {
    await changePasswordUseCase(newPassword.value)
    successMessage.value = 'Contrasena actualizada correctamente. Redirigiendo al login...'

    // Clear the temporary token
    localStorage.removeItem(TOKEN_KEY)

    setTimeout(() => router.push('/'), 2000)
  } catch (error) {
    errorMessage.value = error.message || 'Error al restablecer la contrasena. El enlace puede haber expirado.'
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
        <p>Establece tu nueva contrasena.</p>
      </div>

      <div class="login-card__form">
        <!-- No token found -->
        <template v-if="!tokenValid">
          <h1>Enlace Invalido</h1>
          <p class="form-description">
            Este enlace de recuperacion no es valido o ha expirado.
            Solicita uno nuevo desde la pagina de inicio de sesion.
          </p>
          <div class="form-footer">
            <RouterLink to="/forgot-password" class="form-link">Solicitar nuevo enlace</RouterLink>
          </div>
        </template>

        <!-- Token valid — show reset form -->
        <template v-else>
          <h1>Nueva Contrasena</h1>
          <p class="form-description">Ingresa y confirma tu nueva contrasena.</p>

          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>Nueva Contrasena *</label>
              <input
                v-model="newPassword"
                type="password"
                required
                minlength="6"
                placeholder="Minimo 6 caracteres"
                :class="{ 'input-error': errores.newPassword }"
              >
              <span v-if="errores.newPassword" class="error-text">{{ errores.newPassword }}</span>
            </div>

            <div class="form-group">
              <label>Confirmar Contrasena *</label>
              <input
                v-model="confirmPassword"
                type="password"
                required
                placeholder="Repite la contrasena"
                :class="{ 'input-error': errores.confirmPassword }"
              >
              <span v-if="errores.confirmPassword" class="error-text">{{ errores.confirmPassword }}</span>
            </div>

            <p v-if="errorMessage" class="errorMessage">{{ errorMessage }}</p>
            <p v-if="successMessage" class="successMessage">{{ successMessage }}</p>

            <button type="submit" class="btn-submit" :disabled="cargando">
              {{ cargando ? 'Guardando...' : 'Restablecer Contrasena' }}
            </button>
          </form>

          <div class="form-footer">
            <RouterLink to="/" class="form-link">Volver al inicio de sesion</RouterLink>
          </div>
        </template>
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

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-main);
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: var(--radius-md);
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-500);
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

.btn-submit {
  padding: 15px;
  margin-top: 1.5rem;
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
  .form-group input { padding: 14px; font-size: 16px; }
  .btn-submit { margin-top: 1.5rem; padding: 18px; font-size: 1.1rem; }
}
</style>

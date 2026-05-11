<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'
import { checkEmailUseCase } from '@/application/use-cases/auth/CheckEmailUseCase'

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

      <div class="login-card__banner">
        <svg class="banner-bg" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <!-- Circulos flotantes -->
          <circle class="banner-shape banner-shape--1" cx="50" cy="80" r="60" />
          <circle class="banner-shape banner-shape--2" cx="350" cy="500" r="90" />
          <circle class="banner-shape banner-shape--3" cx="300" cy="120" r="35" />
          <!-- Ondas -->
          <path class="banner-wave banner-wave--1" d="M0,450 C100,400 200,500 400,430 L400,600 L0,600 Z" />
          <path class="banner-wave banner-wave--2" d="M0,480 C150,440 250,520 400,470 L400,600 L0,600 Z" />
          <!-- Red de nodos -->
          <line class="banner-line" x1="60" y1="200" x2="200" y2="300" />
          <line class="banner-line" x1="200" y1="300" x2="340" y2="250" />
          <line class="banner-line" x1="340" y1="250" x2="280" y2="400" />
          <line class="banner-line" x1="200" y1="300" x2="120" y2="420" />
          <circle class="banner-node" cx="60" cy="200" r="4" />
          <circle class="banner-node" cx="200" cy="300" r="5" />
          <circle class="banner-node" cx="340" cy="250" r="4" />
          <circle class="banner-node" cx="280" cy="400" r="4" />
          <circle class="banner-node" cx="120" cy="420" r="4" />
        </svg>
        <div class="banner-content">
          <h3>
            <span class="banner-letter" style="--i:0">T</span><span class="banner-letter" style="--i:1">Y</span><span class="banner-letter" style="--i:2">F</span><span class="banner-letter" style="--i:3">L</span><span class="banner-letter" style="--i:4">O</span><span class="banner-letter" style="--i:5">W</span>
          </h3>
          <p>Gestiona y optimiza tu reparto de manera eficiente.</p>
        </div>
      </div>

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

.login-card__banner {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(160deg, #1a9e6f 0%, #2AC78F 40%, #3EE0A1 100%);
  padding: 60px;
  color: white;
  text-align: center;
  overflow: hidden;
}

/* SVG fondo */
.banner-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.banner-shape {
  fill: rgba(255, 255, 255, 0.06);
}

.banner-shape--1 {
  animation: float 8s ease-in-out infinite;
}

.banner-shape--2 {
  animation: float 10s ease-in-out infinite 2s;
}

.banner-shape--3 {
  animation: float 7s ease-in-out infinite 4s;
}

.banner-wave--1 {
  fill: rgba(255, 255, 255, 0.08);
  animation: wave 6s ease-in-out infinite;
}

.banner-wave--2 {
  fill: rgba(255, 255, 255, 0.05);
  animation: wave 8s ease-in-out infinite 1s;
}

.banner-line {
  stroke: rgba(255, 255, 255, 0.15);
  stroke-width: 1;
  stroke-dasharray: 6 4;
  animation: dash 12s linear infinite;
}

.banner-node {
  fill: rgba(255, 255, 255, 0.5);
  animation: pulse 3s ease-in-out infinite;
}

.banner-node:nth-child(even) {
  animation-delay: 1.5s;
}

/* Contenido */
.banner-content {
  position: relative;
  z-index: 1;
  animation: fadeUp 0.8s ease-out both;
}

.banner-content h3 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  letter-spacing: 0.15em;
}

.banner-letter {
  display: inline-block;
  opacity: 0;
  animation: letterDrop 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards calc(0.3s + var(--i) * 0.1s);
  will-change: transform, opacity;
}

@keyframes letterDrop {
  0% { opacity: 0; transform: translateY(-30px) scale(0.5); filter: blur(4px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

.banner-content p {
  opacity: 0.9;
  animation: fadeUp 0.8s ease-out both 0.4s;
}

/* Animaciones */
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}

@keyframes wave {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

@keyframes dash {
  to { stroke-dashoffset: -120; }
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; r: 4; }
  50% { opacity: 1; r: 6; }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
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

  .banner-content h3 {
    font-size: 2rem;
  }

  .banner-content p {
    font-size: 0.9rem;
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

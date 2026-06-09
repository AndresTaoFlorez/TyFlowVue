<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'
import { checkEmailUseCase } from '@/application/use-cases/auth/CheckEmailUseCase'
import LoginBanner from '@/presentation/components/layout/LoginBanner.vue'
import gsap from 'gsap'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')
const cargando = ref(false)
const emailExiste = ref(false)
const mostrarCarga = ref(false)

const authCard = ref(null)
const authForm = ref(null)
const loginBanner = ref(null)
const authLoading = ref(null)

const esMobile = () => window.matchMedia('(max-width: 768px)').matches

onMounted(() => {
  const card = authCard.value
  const form = authForm.value
  const bannerEl = loginBanner.value.$el
  const mobile = esMobile()

  // Card empieza invisible — dimensiones intactas (900px, 1fr 1fr)
  gsap.set(card, { opacity: 0 })

  if (!mobile) {
    // Ambas columnas empiezan superpuestas en el centro
    gsap.set(bannerEl, { x: '50%' })
    gsap.set(form, { x: '-50%', opacity: 0 })
  } else {
    gsap.set(form, { opacity: 0 })
  }

  const tl = gsap.timeline({ delay: 0.15 })

  // Paso 1: fade in del card
  tl.to(card, { opacity: 1, duration: 0.4, ease: 'power2.out' })

  if (!mobile) {
    // Paso 2: separar columnas desde el centro hacia sus posiciones naturales
    tl.to(bannerEl, { x: 0, duration: 0.7, ease: 'power3.out' }, '+=0.05')
    tl.to(form, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, '<')
  } else {
    tl.to(form, { opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.15')
  }
})

const handleSubmit = async () => {
  errorMessage.value = ''
  emailExiste.value = false
  cargando.value = true

  try {
    await authStore.login(email.value, password.value)

    const mobile = esMobile()
    const bannerEl = loginBanner.value.$el

    // Animar cierre: form se desliza detrás del banner
    const exitTl = gsap.timeline()
    if (!mobile) {
      // Form se esconde detrás del banner (hacia la izquierda)
      exitTl.to(authForm.value, { x: '-50%', opacity: 0, duration: 0.6, ease: 'power3.inOut' })
      // Banner se centra
      exitTl.to(bannerEl, { x: '50%', duration: 0.6, ease: 'power3.inOut' }, '<')
    } else {
      exitTl.to(authForm.value, { opacity: 0, duration: 0.5, ease: 'power3.in' })
    }
    await exitTl

    // Pausa: el banner queda solo como "loader"
    await new Promise(r => setTimeout(r, 500))

    // Overlay de carga
    mostrarCarga.value = true
    await nextTick()

    gsap.from(authLoading.value, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out',
    })

    await new Promise(r => setTimeout(r, 700))

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
    try { exists = await checkEmailUseCase(email.value.trim()) } catch { }
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
    <div ref="authCard" class="auth-card">

      <LoginBanner ref="loginBanner" />

      <div ref="authForm" class="auth-form">
        <h1 class="auth-form__title">Autenticacion</h1>

        <form @submit.prevent="handleSubmit" class="auth-form__body">
          <div class="form-group">
            <label for="email">Usuario</label>
            <input v-model="email" type="email" id="email" placeholder="correo@ejemplo.com" required>
          </div>

          <div class="form-group">
            <label for="password">Contrasena</label>
            <div class="input-wrap">
              <input v-model="password" :type="showPassword ? 'text' : 'password'" id="password" placeholder="••••••••"
                required>
              <button type="button" class="input-wrap__toggle" @click="showPassword = !showPassword" tabindex="-1">
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

      <div v-if="mostrarCarga" ref="authLoading" class="auth-loading">
      </div>

    </div>
  </main>
</template>

<style scoped src="@/styles/views/LoginView.css"></style>

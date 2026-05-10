<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'
import ChangePasswordModal from '@/presentation/components/ChangePasswordModal.vue'

const authStore = useAuthStore()
const router = useRouter()
const mostrarCambiarClave = ref(false)

const handleLogout = () => {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="layout">
    <header class="layout__header topbar">
      <div class="topbar__brand">
        <h2>Bienvenido, {{ authStore.profile?.firstName }}</h2>
      </div>
      <div class="topbar__actions">
        <button class="btn-secondary" @click="mostrarCambiarClave = true">
          <i class='bx bx-lock-alt'></i> Cambiar Clave
        </button>
      </div>
    </header>

    <aside class="layout__sidebar sidebar">
      <ul class="sidebar__list">
        <li class="sidebar__item">
          <RouterLink :to="{ name: 'dashboard' }" class="sidebar__link" active-class="sidebar__link--active">
            <i class='bx bx-home-alt-2 sidebar__icon'></i>
            Inicio
          </RouterLink>
        </li>
        <li class="sidebar__item">
          <RouterLink :to="{ name: 'users' }" class="sidebar__link" active-class="sidebar__link--active">
            <i class='bx bx-user sidebar__icon'></i>
            Usuarios
          </RouterLink>
        </li>
      </ul>

      <div class="sidebar__footer">
        <button @click="handleLogout" class="sidebar__link sidebar__link--logout">
          <i class='bx bx-power-off sidebar__icon'></i> Cerrar sesion
        </button>
      </div>
    </aside>

    <main class="layout__main">
      <router-view />
    </main>

    <ChangePasswordModal
      v-if="mostrarCambiarClave"
      @close="mostrarCambiarClave = false"
    />
  </div>
</template>

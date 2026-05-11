<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'
import ChangePasswordModal from '@/presentation/components/ChangePasswordModal.vue'

const authStore = useAuthStore()
const router = useRouter()
const mostrarCambiarClave = ref(false)
const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)

const toggleSidebar = () => {
  if (window.innerWidth <= 768) {
    sidebarMobileOpen.value = !sidebarMobileOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

const closeMobileSidebar = () => {
  sidebarMobileOpen.value = false
}

const handleLogout = () => {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="layout" :class="{ 'layout--collapsed': sidebarCollapsed, 'layout--mobile-open': sidebarMobileOpen }">
    <header class="layout__header topbar">
      <div class="topbar__left">
        <button class="sidebar-toggle" @click="toggleSidebar" aria-label="Toggle sidebar">
          <i class='bx' :class="sidebarCollapsed ? 'bx-menu' : 'bx-menu-alt-left'"></i>
        </button>
        <h2 class="topbar__title">Bienvenido, {{ authStore.profile?.firstName }}</h2>
      </div>
      <div class="topbar__actions">
        <button class="btn-secondary" @click="mostrarCambiarClave = true">
          <i class='bx bx-lock-alt'></i> <span class="hide-mobile">Cambiar Clave</span>
        </button>
      </div>
    </header>

    <div class="layout__overlay" @click="closeMobileSidebar"></div>

    <aside class="layout__sidebar sidebar">
      <ul class="sidebar__list">
        <li class="sidebar__item">
          <RouterLink :to="{ name: 'dashboard' }" class="sidebar__link" active-class="sidebar__link--active" @click="closeMobileSidebar">
            <i class='bx bx-home-alt-2 sidebar__icon'></i>
            <span class="sidebar__label">Inicio</span>
          </RouterLink>
        </li>
        <li class="sidebar__item">
          <RouterLink :to="{ name: 'users' }" class="sidebar__link" active-class="sidebar__link--active" @click="closeMobileSidebar">
            <i class='bx bx-user sidebar__icon'></i>
            <span class="sidebar__label">Usuarios</span>
          </RouterLink>
        </li>
      </ul>

      <div class="sidebar__footer">
        <button @click="handleLogout" class="sidebar__link sidebar__link--logout">
          <i class='bx bx-power-off sidebar__icon'></i>
          <span class="sidebar__label">Cerrar sesion</span>
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

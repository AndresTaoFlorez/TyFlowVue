<script setup>
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'
import { useRouter } from 'vue-router'
import logoSrc from '@/assets/logo.svg'

const authStore = useAuthStore()
const prefs = usePreferencesStore()
const router = useRouter()

defineProps({
  collapsed: { type: Boolean, default: false }
})

defineEmits(['navigate', 'toggle-sidebar'])

const handleLogout = () => {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <aside class="layout__sidebar sidebar">
    <div class="sidebar__header">
      <div class="sidebar__brand">
        <img :src="logoSrc" alt="TyFlow" class="sidebar__logo" />
        <span class="sidebar__brand-name sidebar__label">TyFlow</span>
      </div>
      <button class="sidebar__collapse-btn" @click="$emit('toggle-sidebar')" aria-label="Toggle sidebar">
        <i class='bx' :class="collapsed ? 'bx-chevron-right' : 'bx-chevron-left'"></i>
      </button>
    </div>
    <ul class="sidebar__list">
      <li v-if="prefs.menus.home" class="sidebar__item">
        <RouterLink :to="{ name: 'dashboard' }" class="sidebar__link" active-class="sidebar__link--active" @click="$emit('navigate')">
          <i class='bx bx-home-alt-2 sidebar__icon'></i>
          <span class="sidebar__label">Inicio</span>
        </RouterLink>
      </li>
      <li v-if="authStore.isAdmin" class="sidebar__item">
        <RouterLink :to="{ name: 'users' }" class="sidebar__link" active-class="sidebar__link--active" @click="$emit('navigate')">
          <i class='bx bx-group sidebar__icon'></i>
          <span class="sidebar__label">Usuarios</span>
        </RouterLink>
      </li>
      <li v-if="authStore.isAdmin && prefs.menus.applications" class="sidebar__item">
        <RouterLink :to="{ name: 'applications' }" class="sidebar__link" active-class="sidebar__link--active" @click="$emit('navigate')">
          <i class='bx bx-cube sidebar__icon'></i>
          <span class="sidebar__label">Aplicaciones</span>
        </RouterLink>
      </li>
      <li class="sidebar__item">
        <RouterLink :to="{ name: 'calendario' }" class="sidebar__link" active-class="sidebar__link--active" @click="$emit('navigate')">
          <i class='bx bx-calendar sidebar__icon'></i>
          <span class="sidebar__label">Calendario</span>
        </RouterLink>
      </li>
      <li v-if="prefs.menus.cases" class="sidebar__item">
        <RouterLink :to="{ name: 'casos-lista', params: { status: 'open' } }" class="sidebar__link" active-class="sidebar__link--active" @click="$emit('navigate')">
          <i class='bx bx-task sidebar__icon'></i>
          <span class="sidebar__label">Casos</span>
        </RouterLink>
      </li>
      <li v-if="prefs.menus.settings" class="sidebar__item">
        <RouterLink :to="{ name: 'settings' }" class="sidebar__link" active-class="sidebar__link--active" @click="$emit('navigate')">
          <i class='bx bx-cog sidebar__icon'></i>
          <span class="sidebar__label">Configuración</span>
        </RouterLink>
      </li>
      <li class="sidebar__item">
        <RouterLink :to="{ name: 'profile' }" class="sidebar__link" active-class="sidebar__link--active" @click="$emit('navigate')">
          <i class='bx bx-user sidebar__icon'></i>
          <span class="sidebar__label">Mi Perfil</span>
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
</template>

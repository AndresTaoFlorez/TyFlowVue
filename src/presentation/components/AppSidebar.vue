<script setup>
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

defineEmits(['navigate'])

const handleLogout = () => {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <aside class="layout__sidebar sidebar">
    <ul class="sidebar__list">
      <li class="sidebar__item">
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
      <li v-if="authStore.isAdmin" class="sidebar__item">
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

<script setup>
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const authStore = useAuthStore()

defineProps({
  collapsed: { type: Boolean, default: false }
})

defineEmits(['toggle-sidebar', 'change-password'])
</script>

<template>
  <header class="layout__header topbar">
    <div class="topbar__left">
      <button class="sidebar-toggle" @click="$emit('toggle-sidebar')" aria-label="Toggle sidebar">
        <i class='bx' :class="collapsed ? 'bx-menu' : 'bx-menu-alt-left'"></i>
      </button>
      <h2 class="topbar__title">Bienvenido, {{ authStore.profile?.firstName }}</h2>
    </div>
    <div class="topbar__actions">
      <button class="btn-secondary" @click="$emit('change-password')" aria-label="Cambiar Clave">
        <i class='bx bx-lock-alt'></i> <span class="hide-mobile">Cambiar Clave</span>
      </button>
    </div>
  </header>
</template>

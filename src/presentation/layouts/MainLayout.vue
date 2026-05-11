<script setup>
import { ref } from 'vue'
import AppTopbar from '@/presentation/components/AppTopbar.vue'
import AppSidebar from '@/presentation/components/AppSidebar.vue'
import ChangePasswordModal from '@/presentation/components/ChangePasswordModal.vue'

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
</script>

<template>
  <div class="layout" :class="{ 'layout--collapsed': sidebarCollapsed, 'layout--mobile-open': sidebarMobileOpen }">
    <AppTopbar
      :collapsed="sidebarCollapsed"
      @toggle-sidebar="toggleSidebar"
      @change-password="mostrarCambiarClave = true"
    />

    <div class="layout__overlay" @click="closeMobileSidebar"></div>

    <AppSidebar @navigate="closeMobileSidebar" />

    <main class="layout__main">
      <router-view />
    </main>

    <ChangePasswordModal
      v-if="mostrarCambiarClave"
      @close="mostrarCambiarClave = false"
    />
  </div>
</template>

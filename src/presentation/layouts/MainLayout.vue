<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppTopbar from '@/presentation/components/AppTopbar.vue'
import AppSidebar from '@/presentation/components/AppSidebar.vue'
import ChangePasswordModal from '@/presentation/components/ChangePasswordModal.vue'

const route = useRoute()
const mostrarCambiarClave = ref(false)
const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)
const viewportWidth = ref(window.innerWidth)

const flushRoutes = ['/app/applications', '/app/calendario']
const isFlush = computed(() => flushRoutes.some(r => route.path.startsWith(r)))

// Auto-collapse sidebar on dense views when viewport is narrow
const denseRoutes = ['/app/applications', '/app/calendario']
let userExpandedSidebar = false

watch([() => route.path, viewportWidth], ([path, width]) => {
  const isDense = denseRoutes.some(r => path.startsWith(r))
  if (isDense && width < 1200 && width > 768 && !sidebarCollapsed.value && !userExpandedSidebar) {
    sidebarCollapsed.value = true
  }
}, { immediate: true })

const toggleSidebar = () => {
  if (window.innerWidth <= 768) {
    sidebarMobileOpen.value = !sidebarMobileOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
    userExpandedSidebar = !sidebarCollapsed.value
  }
}

const closeMobileSidebar = () => {
  sidebarMobileOpen.value = false
}

function onResize() {
  viewportWidth.value = window.innerWidth
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
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

    <main class="layout__main" :class="{ 'layout__main--flush': isFlush }">
      <router-view />
    </main>

    <ChangePasswordModal
      v-if="mostrarCambiarClave"
      @close="mostrarCambiarClave = false"
    />
  </div>
</template>

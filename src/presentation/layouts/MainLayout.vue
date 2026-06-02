<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppTopbar from '@/presentation/components/AppTopbar.vue'
import AppSidebar from '@/presentation/components/AppSidebar.vue'
import ChangePasswordModal from '@/presentation/components/ChangePasswordModal.vue'
import { BP_MOBILE } from '@/presentation/utils/breakpoints'

const route = useRoute()
const mostrarCambiarClave = ref(false)
const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)
const viewportWidth = ref(window.innerWidth)

// ---- Resizable sidebar (Outlook-style) ----
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 260
const sidebarWidth = ref(parseInt(localStorage.getItem('tyflow_sidebar_width') || String(SIDEBAR_DEFAULT)))
const sidebarResizing = ref(false)

const layoutStyle = computed(() => {
  if (viewportWidth.value <= BP_MOBILE) return {}
  const width = sidebarCollapsed.value ? 72 : sidebarWidth.value
  const style = { gridTemplateColumns: `${width}px 1fr` }
  if (sidebarResizing.value) style.transition = 'none'
  return style
})

let resizeStartX = 0
let resizeStartWidth = 0

const onSidebarResizeStart = (e) => {
  sidebarResizing.value = true
  resizeStartX = e.clientX
  resizeStartWidth = sidebarWidth.value
  document.addEventListener('mousemove', onSidebarResizeMove)
  document.addEventListener('mouseup', onSidebarResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onSidebarResizeMove = (e) => {
  sidebarWidth.value = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, resizeStartWidth + (e.clientX - resizeStartX)))
}

const onSidebarResizeEnd = () => {
  sidebarResizing.value = false
  document.removeEventListener('mousemove', onSidebarResizeMove)
  document.removeEventListener('mouseup', onSidebarResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  localStorage.setItem('tyflow_sidebar_width', String(sidebarWidth.value))
}

const onSidebarResizeDblclick = () => {
  sidebarWidth.value = SIDEBAR_DEFAULT
  localStorage.setItem('tyflow_sidebar_width', String(SIDEBAR_DEFAULT))
}

const flushRoutes = ['/app/applications', '/app/calendario', '/app/casos']
const isFlush = computed(() => flushRoutes.some(r => route.path.startsWith(r)))

// Auto-collapse sidebar on dense views when viewport is narrow
const denseRoutes = ['/app/applications', '/app/calendario', '/app/casos']
let userExpandedSidebar = false

watch([() => route.path, viewportWidth], ([path, width]) => {
  const isDense = denseRoutes.some(r => path.startsWith(r))
  if (isDense && width < 1200 && width > 768 && !sidebarCollapsed.value && !userExpandedSidebar) {
    sidebarCollapsed.value = true
  }
}, { immediate: true })

const toggleSidebar = () => {
  if (window.innerWidth <= BP_MOBILE) {
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
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('mousemove', onSidebarResizeMove)
  document.removeEventListener('mouseup', onSidebarResizeEnd)
})
</script>

<template>
  <div class="layout" :class="{ 'layout--collapsed': sidebarCollapsed, 'layout--mobile-open': sidebarMobileOpen }" :style="layoutStyle">
    <AppTopbar
      :collapsed="sidebarCollapsed"
      @toggle-sidebar="toggleSidebar"
    />

    <div class="layout__overlay" @click="closeMobileSidebar"></div>

    <AppSidebar :collapsed="sidebarCollapsed" @navigate="closeMobileSidebar" @toggle-sidebar="toggleSidebar" />

    <div
      v-if="!sidebarCollapsed && viewportWidth > 768"
      class="layout__resize"
      :class="{ 'layout__resize--active': sidebarResizing }"
      :style="{ left: sidebarWidth + 'px' }"
      @mousedown.prevent="onSidebarResizeStart"
      @dblclick="onSidebarResizeDblclick"
    ></div>

    <main class="layout__main" :class="{ 'layout__main--flush': isFlush }">
      <router-view />
    </main>

    <ChangePasswordModal
      v-if="mostrarCambiarClave"
      @close="mostrarCambiarClave = false"
    />
  </div>
</template>

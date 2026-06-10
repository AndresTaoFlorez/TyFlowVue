<script setup>
import '@/styles/components/layout/main-layout.css'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppTopbar from '@/presentation/components/layout/AppTopbar.vue'
import AppSidebar from '@/presentation/components/layout/AppSidebar.vue'
import ChangePasswordModal from '@/presentation/components/users/ChangePasswordModal.vue'
import { BP_MOBILE } from '@/presentation/utils/breakpoints'
import { wsStatus } from '@/infrastructure/realtime/wsClient'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'
import { MENU_ROUTE_MAP } from '@/router'

const route = useRoute()
const router = useRouter()
const prefs = usePreferencesStore()

// Redirect when the current route's menu preference is toggled off
watch(() => prefs.menus, (menus) => {
  const menuKey = MENU_ROUTE_MAP[route.name]
  if (menuKey && !menus[menuKey]) {
    router.replace(menus.home ? { name: 'dashboard' } : { name: 'calendar' })
  }
}, { deep: true })

// Debounced WS indicator — only show after 4s of not being connected
const showWsWarning = ref(false)
let _wsTimer = null
watch(wsStatus, (s) => {
  if (s === 'connected' || s === 'disconnected' && !_wsTimer) {
    clearTimeout(_wsTimer)
    _wsTimer = null
    showWsWarning.value = false
  }
  if (s === 'reconnecting') {
    if (!_wsTimer) _wsTimer = setTimeout(() => { showWsWarning.value = true }, 4000)
  }
  if (s === 'disconnected') {
    showWsWarning.value = true
  }
})
const mostrarCambiarClave = ref(false)
const sidebarCollapsed = ref(localStorage.getItem('tyflow_sidebar_collapsed') === 'true')
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

// El colapsado solo aplica en escritorio. En móvil la sidebar es un drawer
// (position: fixed, ancho expandido); si heredara .layout--collapsed se vería
// ancha pero con contenido colapsado (iconos centrados, sin labels).
const collapsedDesktop = computed(() => sidebarCollapsed.value && viewportWidth.value > BP_MOBILE)

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

const flushRoutes = ['/app/applications', '/app/calendar', '/app/cases']
const isFlush = computed(() => flushRoutes.some(r => route.path.startsWith(r)))

// Auto-collapse sidebar on dense views when viewport is narrow
const denseRoutes = ['/app/applications', '/app/calendar', '/app/cases']
let userExpandedSidebar = false

const persistCollapsed = (val) => {
  sidebarCollapsed.value = val
  localStorage.setItem('tyflow_sidebar_collapsed', String(val))
}

watch([() => route.path, viewportWidth], ([path, width]) => {
  const isDense = denseRoutes.some(r => path.startsWith(r))
  if (isDense && width < 1200 && width > 768 && !sidebarCollapsed.value && !userExpandedSidebar) {
    persistCollapsed(true)
  }
}, { immediate: true })

const toggleSidebar = () => {
  if (window.innerWidth <= BP_MOBILE) {
    sidebarMobileOpen.value = !sidebarMobileOpen.value
  } else {
    persistCollapsed(!sidebarCollapsed.value)
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
  <div class="layout" :class="{ 'layout--collapsed': collapsedDesktop, 'layout--mobile-open': sidebarMobileOpen }" :style="layoutStyle">
    <AppTopbar
      :collapsed="sidebarCollapsed"
      @toggle-sidebar="toggleSidebar"
    />

    <div class="layout__overlay" @click="closeMobileSidebar"></div>

    <AppSidebar :collapsed="collapsedDesktop" @navigate="closeMobileSidebar" @toggle-sidebar="toggleSidebar" />

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

    <Transition name="ws-fade">
      <div v-if="showWsWarning" class="layout__ws-pill" :class="{ 'layout__ws-pill--off': wsStatus === 'disconnected' }">
        <i class="bx bx-wifi-off"></i>
        {{ wsStatus === 'disconnected' ? 'Sin conexión' : 'Reconectando...' }}
      </div>
    </Transition>

    <ChangePasswordModal
      v-if="mostrarCambiarClave"
      @close="mostrarCambiarClave = false"
    />
  </div>
</template>

<script setup>
import '@/styles/components/layout/sidebar.css'
import { ref, onMounted, onUnmounted } from 'vue'
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

const emit = defineEmits(['navigate', 'toggle-sidebar'])

// ---- Menú contextual del brand (estilo Notion) ----
// El dropdown va en position:fixed (coordenadas del brand) porque .sidebar y
// .layout__sidebar tienen overflow:hidden (animación de colapso) y un
// absolute se recortaría con la sidebar angosta.
const menuOpen = ref(false)
const brandWrapRef = ref(null)
const menuPos = ref({ top: '0px', left: '0px' })

function toggleMenu() {
  if (!menuOpen.value && brandWrapRef.value) {
    const r = brandWrapRef.value.getBoundingClientRect()
    menuPos.value = { top: `${r.bottom + 6}px`, left: `${r.left}px` }
  }
  menuOpen.value = !menuOpen.value
}
function closeMenu() { menuOpen.value = false }

function navigateAndClose() {
  closeMenu()
  emit('navigate')
}

function onDocPointerDown(e) {
  if (menuOpen.value && brandWrapRef.value && !brandWrapRef.value.contains(e.target)) closeMenu()
}
function onDocKeydown(e) {
  if (e.key === 'Escape') closeMenu()
}

// Fixed no sigue al brand si cambia el layout: cerrar en resize.
function onWinResize() { closeMenu() }

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
  window.addEventListener('resize', onWinResize)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
  window.removeEventListener('resize', onWinResize)
})

const handleLogout = () => {
  closeMenu()
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <aside class="layout__sidebar sidebar">
    <div class="sidebar__header">
      <div ref="brandWrapRef" class="sidebar__brand-wrap">
        <button
          class="sidebar__brand"
          :class="{ 'sidebar__brand--open': menuOpen }"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          <img :src="logoSrc" alt="TyFlow" class="sidebar__logo" />
          <span class="sidebar__brand-name sidebar__label">TyFlow</span>
          <i class='bx bx-chevron-down sidebar__brand-caret'></i>
        </button>

        <Transition name="navmenu">
          <nav v-if="menuOpen" class="navmenu" role="menu" :style="menuPos">
            <RouterLink v-if="prefs.menus.home" :to="{ name: 'dashboard' }" class="navmenu__item" active-class="navmenu__item--active" role="menuitem" @click="navigateAndClose">
              <i class='bx bx-home-alt-2 navmenu__icon'></i>
              <span>Inicio</span>
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin" :to="{ name: 'users' }" class="navmenu__item" active-class="navmenu__item--active" role="menuitem" @click="navigateAndClose">
              <i class='bx bx-group navmenu__icon'></i>
              <span>Usuarios</span>
            </RouterLink>
            <RouterLink v-if="authStore.isAdmin && prefs.menus.applications" :to="{ name: 'applications' }" class="navmenu__item" active-class="navmenu__item--active" role="menuitem" @click="navigateAndClose">
              <i class='bx bx-cube navmenu__icon'></i>
              <span>Aplicaciones</span>
            </RouterLink>
            <RouterLink :to="{ name: 'calendar' }" class="navmenu__item" active-class="navmenu__item--active" role="menuitem" @click="navigateAndClose">
              <i class='bx bx-calendar navmenu__icon'></i>
              <span>Calendario</span>
            </RouterLink>
            <RouterLink v-if="prefs.menus.cases" :to="{ name: 'cases-list' }" class="navmenu__item" active-class="navmenu__item--active" role="menuitem" @click="navigateAndClose">
              <i class='bx bx-task navmenu__icon'></i>
              <span>Casos</span>
            </RouterLink>
            <RouterLink :to="{ name: 'settings' }" class="navmenu__item" active-class="navmenu__item--active" role="menuitem" @click="navigateAndClose">
              <i class='bx bx-cog navmenu__icon'></i>
              <span>Configuración</span>
            </RouterLink>
            <RouterLink :to="{ name: 'profile' }" class="navmenu__item" active-class="navmenu__item--active" role="menuitem" @click="navigateAndClose">
              <i class='bx bx-user navmenu__icon'></i>
              <span>Mi Perfil</span>
            </RouterLink>

            <div class="navmenu__sep"></div>

            <button class="navmenu__item navmenu__item--logout" role="menuitem" @click="handleLogout">
              <i class='bx bx-power-off navmenu__icon'></i>
              <span>Cerrar sesión</span>
            </button>
          </nav>
        </Transition>
      </div>

      <button class="sidebar__collapse-btn" @click="$emit('toggle-sidebar')" aria-label="Ocultar menú (b)" title="Ocultar menú (b)">
        <i class='bx bx-chevrons-left'></i>
      </button>
    </div>

    <!-- Board contextual: las vistas publican aquí su contenido vía
         <SidebarBoard> (calendario: Crear/mini-cal/filtros; settings: secciones).
         v-show (no v-if): el outlet debe existir siempre para el Teleport.
         Colapsado se oculta: el rail colapsa a 0 y el .nav-fab lo reabre. -->
    <div v-show="!collapsed" id="sidebar-board" class="sidebar__board"></div>
  </aside>
</template>

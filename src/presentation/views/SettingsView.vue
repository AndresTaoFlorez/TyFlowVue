<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useSettingsStore } from '@/presentation/stores/useSettingsStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import SettingsAppearance from '@/presentation/components/settings/SettingsAppearance.vue'
import SettingsNotifications from '@/presentation/components/settings/SettingsNotifications.vue'
import SettingsCalendar from '@/presentation/components/settings/SettingsCalendar.vue'
import SettingsRoles from '@/presentation/components/settings/SettingsRoles.vue'
import SettingsHierarchy from '@/presentation/components/settings/SettingsHierarchy.vue'
import SidebarBoard from '@/presentation/components/layout/SidebarBoard.vue'
import TopbarBoard from '@/presentation/components/layout/TopbarBoard.vue'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const userStore = useUserStore()

const sections = computed(() => {
  const items = [
    { id: 'appearance', label: 'Apariencia', icon: 'bx-palette' },
    { id: 'notifications', label: 'Notificaciones', icon: 'bx-bell' },
    { id: 'calendar', label: 'Calendario', icon: 'bx-calendar' },
  ]
  if (authStore.isAdmin) {
    items.push(
      { id: 'roles', label: 'Roles', icon: 'bx-shield-quarter' },
      { id: 'hierarchy', label: 'Jerarquía de Soporte', icon: 'bx-sitemap' },
    )
  }
  return items
})

const activeSection = ref('appearance')

onMounted(async () => {
  if (authStore.isAdmin) {
    await userStore.loadSelects()
  }
})
</script>

<template>
  <div class="sv">
    <!-- Topbar board: título + switcher de secciones (el switcher solo es
         visible en pantallas chicas, donde el sidebar es un drawer y la
         navegación contextual quedaría enterrada). -->
    <TopbarBoard>
      <div class="sv__topbar">
        <span class="sv__topbar-title">Configuración</span>
        <nav class="sv__topnav" aria-label="Secciones de configuración">
          <button
            v-for="s in sections"
            :key="s.id"
            class="sv__topnav-btn"
            :class="{ 'sv__topnav-btn--active': activeSection === s.id }"
            :title="s.label"
            @click="activeSection = s.id"
          >
            <i :class="'bx ' + s.icon"></i>
          </button>
        </nav>
      </div>
    </TopbarBoard>

    <!-- Secciones → board del sidebar (contrato de boards del shell) -->
    <SidebarBoard>
      <nav class="sv__nav">
        <span class="sv__nav-title">Secciones</span>
        <button
          v-for="s in sections"
          :key="s.id"
          class="sv__nav-item"
          :class="{ 'sv__nav-item--active': activeSection === s.id }"
          @click="activeSection = s.id"
        >
          <i :class="'bx ' + s.icon"></i>
          <span>{{ s.label }}</span>
        </button>
      </nav>
    </SidebarBoard>

    <div class="sv__content">
      <SettingsAppearance v-if="activeSection === 'appearance'" />
      <SettingsNotifications v-else-if="activeSection === 'notifications'" />
      <SettingsCalendar v-else-if="activeSection === 'calendar'" />
      <SettingsRoles v-else-if="activeSection === 'roles'" />
      <SettingsHierarchy v-else-if="activeSection === 'hierarchy'" />
    </div>
  </div>
</template>

<style scoped>
.sv {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Nav de secciones: vive en el board del sidebar (nav rail) → tokens --nav-*
   theme-aware, mismo lenguaje visual que CalSidebar (.cside). */
.sv__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border-top: 1px solid var(--nav-border);
  margin-top: 0.85rem;
  padding: 0.85rem 0.65rem 1.1rem;
  overflow-y: auto;
  min-height: 0;
}

.sv__nav-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--nav-text);
  opacity: 0.75;
  padding: 0.15rem;
  margin-bottom: 0.35rem;
}

.sv__nav-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--nav-text);
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: left;
}

.sv__nav-item:hover {
  background: var(--nav-hover);
  color: var(--nav-text-strong);
}

.sv__nav-item--active {
  background: var(--nav-hover);
  color: var(--primary-500);
  font-weight: 600;
}

.sv__nav-item i { font-size: 1.1rem; }

.sv__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

/* ── Topbar board ── */
.sv__topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.sv__topbar-title {
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

/* Switcher de secciones: solo visible en pantallas chicas */
.sv__topnav {
  display: none;
  align-items: center;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  overflow: hidden;
  background: var(--bg-card);
  flex-shrink: 0;
}

.sv__topnav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.05rem;
  cursor: pointer;
  transition: all 0.12s;
}
.sv__topnav-btn + .sv__topnav-btn { border-left: 1px solid var(--border-light); }
.sv__topnav-btn:hover { color: var(--text-primary); }
.sv__topnav-btn--active {
  color: var(--primary-500);
  background: color-mix(in srgb, var(--primary-500) 12%, transparent);
}

@media (max-width: 768px) {
  .sv__topnav { display: flex; }
  .sv__content { padding: 1rem; }
}

@media (max-width: 768px) {
  .sv__content { padding: 1rem; }
}
</style>

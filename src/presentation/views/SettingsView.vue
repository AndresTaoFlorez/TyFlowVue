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
    <nav class="sv__nav">
      <span class="sv__nav-title">Configuración</span>
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
  display: grid;
  grid-template-columns: 220px 1fr;
  height: 100%;
  overflow: hidden;
}

.sv__nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 1.25rem 0.75rem;
  border-right: 1px solid var(--border-light);
  overflow-y: auto;
}

.sv__nav-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: 0 0.65rem;
  margin-bottom: 0.5rem;
}

.sv__nav-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 0.65rem;
  border-radius: var(--radius-md);
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: left;
}

.sv__nav-item:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.sv__nav-item--active {
  background: var(--bg-card);
  color: var(--primary-500);
  font-weight: 600;
}

.sv__nav-item i { font-size: 1.1rem; }

.sv__content {
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

@media (max-width: 768px) {
  .sv {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .sv__nav {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--border-light);
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    gap: 0.25rem;
  }

  .sv__nav-title { display: none; }

  .sv__nav-item {
    white-space: nowrap;
    padding: 0.5rem 0.65rem;
    font-size: 0.78rem;
  }

  .sv__nav-item span { display: none; }
  .sv__nav-item i { font-size: 1.2rem; }

  .sv__content { padding: 1rem; }
}
</style>

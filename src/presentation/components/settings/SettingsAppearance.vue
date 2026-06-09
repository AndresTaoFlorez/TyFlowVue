<script setup>
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const prefs = usePreferencesStore()
const authStore = useAuthStore()

const MENU_ITEMS = [
  { key: 'home',         label: 'Inicio',          adminOnly: false },
  { key: 'cases',        label: 'Casos',            adminOnly: false },
  { key: 'settings',     label: 'Configuración',    adminOnly: false },
  { key: 'applications', label: 'Aplicaciones',     adminOnly: true  },
]
</script>

<template>
  <section class="ss">
    <h2 class="ss__heading">Apariencia</h2>
    <p class="ss__desc">Personaliza el aspecto visual de la aplicación.</p>

    <div class="ss__group">
      <span class="ss__label">Tema</span>
      <div class="ss__theme-picker">
        <button
          class="ss__theme-opt"
          :class="{ 'ss__theme-opt--active': prefs.theme === 'light' }"
          @click="prefs.theme = 'light'"
        >
          <i class="bx bx-sun"></i>
          <span>Claro</span>
        </button>
        <button
          class="ss__theme-opt"
          :class="{ 'ss__theme-opt--active': prefs.theme === 'dark' }"
          @click="prefs.theme = 'dark'"
        >
          <i class="bx bx-moon"></i>
          <span>Oscuro</span>
        </button>
      </div>
    </div>

    <div class="ss__group ss__group--nav">
      <span class="ss__label">Menú de navegación</span>
      <p class="ss__nav-hint">Elige qué secciones mostrar en el menú lateral.</p>
      <div class="ss__nav-rows">
        <label
          v-for="item in MENU_ITEMS"
          :key="item.key"
          v-show="!item.adminOnly || authStore.isAdmin"
          class="ss__nav-row"
        >
          <span class="ss__nav-label">{{ item.label }}</span>
          <input type="checkbox" v-model="prefs.menus[item.key]" class="ss__toggle" />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ss__heading {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.ss__desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
}

.ss__group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ss__label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.ss__theme-picker {
  display: flex;
  gap: 0.65rem;
}

.ss__theme-opt {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.7rem 1.2rem;
  border-radius: var(--radius-lg);
  border: 2px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.ss__theme-opt:hover {
  border-color: var(--text-secondary);
}

.ss__theme-opt--active {
  border-color: var(--primary-500);
  color: var(--primary-500);
  background: rgba(42, 199, 143, 0.06);
}

.ss__theme-opt i { font-size: 1.15rem; }

.ss__group--nav { margin-top: 1.75rem; }

.ss__nav-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0 0 0.5rem;
}

.ss__nav-rows {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.ss__nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 0.1s;
}
.ss__nav-row:last-child { border-bottom: none; }
.ss__nav-row:hover { background: var(--bg-main); }

.ss__nav-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
}

.ss__toggle {
  width: 40px;
  height: 22px;
  appearance: none;
  background: var(--border-light);
  border-radius: var(--radius-full);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.ss__toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.ss__toggle:checked { background: var(--primary-500); }
.ss__toggle:checked::after { transform: translateX(18px); }
</style>

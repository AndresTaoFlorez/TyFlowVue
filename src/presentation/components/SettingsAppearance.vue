<script setup>
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const prefs = usePreferencesStore()
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
</style>

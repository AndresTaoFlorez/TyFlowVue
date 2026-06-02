<script setup>
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const prefs = usePreferencesStore()

const hours = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00`,
}))
</script>

<template>
  <section class="sc">
    <h2 class="sc__heading">Calendario</h2>
    <p class="sc__desc">Ajusta la visualización del calendario semanal.</p>

    <div class="sc__fields">
      <div class="sc__field">
        <label class="sc__label">Hora de inicio</label>
        <select v-model.number="prefs.calendarStartHour" class="sc__select">
          <option v-for="h in hours" :key="h.value" :value="h.value">{{ h.label }}</option>
        </select>
      </div>

      <div class="sc__field">
        <label class="sc__label">Hora de fin</label>
        <select v-model.number="prefs.calendarEndHour" class="sc__select">
          <option v-for="h in hours" :key="h.value" :value="h.value">{{ h.label }}</option>
        </select>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sc__heading {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.sc__desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
}

.sc__fields {
  display: flex;
  gap: 1.25rem;
}

.sc__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sc__label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.sc__select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
  min-width: 110px;
  transition: border-color 0.12s;
}

.sc__select:focus {
  border-color: var(--primary-500);
}
</style>

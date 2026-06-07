<script setup>
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const prefs = usePreferencesStore()
</script>

<template>
  <section class="sn">
    <h2 class="sn__heading">Notificaciones</h2>
    <p class="sn__desc">Configura qué notificaciones deseas recibir.</p>

    <div class="sn__rows">
      <label class="sn__row">
        <div class="sn__row-text">
          <span class="sn__row-label">Notificaciones emergentes</span>
          <span class="sn__row-hint">Mostrar toast al recibir eventos</span>
        </div>
        <input type="checkbox" v-model="prefs.notificationsToast" class="sn__toggle" />
      </label>

      <label class="sn__row">
        <div class="sn__row-text">
          <span class="sn__row-label">Sonido</span>
          <span class="sn__row-hint">Reproducir sonido con las notificaciones</span>
        </div>
        <input type="checkbox" v-model="prefs.notificationsSound" class="sn__toggle" />
      </label>
    </div>
  </section>
</template>

<style scoped>
.sn__heading {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.sn__desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
}

.sn__rows {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sn__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}

.sn__row:last-child { border-bottom: none; }

.sn__row-text { display: flex; flex-direction: column; gap: 0.1rem; }

.sn__row-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sn__row-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.sn__toggle {
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

.sn__toggle::after {
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

.sn__toggle:checked {
  background: var(--primary-500);
}

.sn__toggle:checked::after {
  transform: translateX(18px);
}
</style>

<script setup>
import { useSettingsStore } from '@/presentation/stores/useSettingsStore'

const store = useSettingsStore()
</script>

<template>
  <section class="sr">
    <h2 class="sr__heading">Roles</h2>
    <p class="sr__desc">Roles del sistema. Se gestionan desde la base de datos.</p>

    <div v-if="store.loading" class="sr__loading">
      <i class="bx bx-loader-alt bx-spin"></i> Cargando...
    </div>

    <div v-else-if="store.roles.length === 0" class="sr__empty">
      No hay roles registrados.
    </div>

    <div v-else class="sr__list">
      <div v-for="role in store.roles" :key="role.id" class="sr__card">
        <i class="bx bx-shield-quarter sr__card-icon"></i>
        <div class="sr__card-info">
          <span class="sr__card-name">{{ role.name }}</span>
          <span class="sr__card-id">{{ role.id.slice(0, 8) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sr__heading {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.sr__desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
}

.sr__loading, .sr__empty {
  font-size: 0.85rem;
  color: var(--text-secondary);
  padding: 1rem 0;
}

.sr__loading i { margin-right: 0.3rem; }

.sr__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr__card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.sr__card-icon {
  font-size: 1.2rem;
  color: var(--primary-500);
}

.sr__card-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.sr__card-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sr__card-id {
  font-size: 0.68rem;
  color: var(--text-secondary);
  font-family: monospace;
}
</style>

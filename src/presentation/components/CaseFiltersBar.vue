<script setup>
import { computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'

const store = useCasesStore()
const userStore = useUserStore()

const statuses = [
  { value: null, label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'assigned', label: 'Asignados' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'resolved', label: 'Resueltos' },
  { value: 'closed', label: 'Cerrados' },
]

const origins = [
  { value: null, label: 'Todos' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'judit', label: 'Judit' },
  { value: 'tyflow', label: 'TyFlow' },
]

const priorities = [
  { value: null, label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

const applications = computed(() => userStore.applications ?? [])

function setFilter(key, value) {
  store.loadCases({ [key]: value })
}
</script>

<template>
  <div class="fb">
    <!-- Status chips -->
    <div class="fb__group">
      <button
        v-for="s in statuses"
        :key="s.value"
        class="fb__chip"
        :class="{ 'fb__chip--active': store.filters.status === s.value }"
        @click="setFilter('status', s.value)"
      >{{ s.label }}</button>
    </div>

    <div class="fb__sep"></div>

    <!-- Origin -->
    <select class="fb__select" :value="store.filters.originType" @change="setFilter('originType', $event.target.value || null)">
      <option value="">Origen: Todos</option>
      <option v-for="o in origins.slice(1)" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>

    <!-- Priority -->
    <select class="fb__select" :value="store.filters.priority" @change="setFilter('priority', $event.target.value || null)">
      <option value="">Prioridad: Todas</option>
      <option v-for="p in priorities.slice(1)" :key="p.value" :value="p.value">{{ p.label }}</option>
    </select>

    <!-- Application -->
    <select class="fb__select" :value="store.filters.applicationId" @change="setFilter('applicationId', $event.target.value || null)">
      <option value="">Aplicación: Todas</option>
      <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
    </select>

    <!-- Count -->
    <span class="fb__count">{{ store.caseCount }} caso{{ store.caseCount !== 1 ? 's' : '' }}</span>
  </div>
</template>

<style scoped>
.fb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.fb__group {
  display: flex;
  gap: 0.25rem;
}

.fb__chip {
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}

.fb__chip:hover { color: var(--text-primary); border-color: var(--text-secondary); }

.fb__chip--active {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}

.fb__sep {
  width: 1px;
  height: 20px;
  background: var(--border-light);
  flex-shrink: 0;
}

.fb__select {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.72rem;
  color: var(--text-primary);
  background: var(--bg-main);
  cursor: pointer;
  outline: none;
}

.fb__select:focus { border-color: var(--primary-500); }

.fb__count {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .fb { gap: 0.35rem; padding: 0.6rem 0.75rem; }
  .fb__group { overflow-x: auto; flex-shrink: 0; }
  .fb__sep { display: none; }
}
</style>

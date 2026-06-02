<script setup>
import { ref, onMounted } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCasesRealtime } from '@/presentation/composables/useCasesRealtime'
import CaseQueue from '@/presentation/components/CaseQueue.vue'
import WddEvaluationPanel from '@/presentation/components/WddEvaluationPanel.vue'
import SpecialistsSidebar from '@/presentation/components/SpecialistsSidebar.vue'
import CaseCreateForm from '@/presentation/components/CaseCreateForm.vue'
import CaseLoadsView from '@/presentation/components/CaseLoadsView.vue'

const store = useCasesStore()
const userStore = useUserStore()
const activeTab = ref('asignaciones')

const tabs = [
  { id: 'asignaciones', label: 'Asignaciones', icon: 'bx-transfer' },
  { id: 'crear', label: 'Crear caso', icon: 'bx-plus-circle' },
  { id: 'cargas', label: 'Cargas', icon: 'bx-bar-chart-alt-2' },
]

useCasesRealtime()

onMounted(async () => {
  await userStore.loadSelects()
  store.loadPendingCases()
  store.loadRecentAssignments()
  if (userStore.applications.length > 0) {
    store.loadWorkloads(userStore.applications[0].id)
  }
})
</script>

<template>
  <div class="cv">
    <!-- Tabs -->
    <nav class="cv__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="cv__tab"
        :class="{ 'cv__tab--active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <i :class="'bx ' + tab.icon + ' cv__tab-icon'"></i>
        {{ tab.label }}
        <span v-if="tab.id === 'asignaciones' && store.pendingCount" class="cv__tab-badge">
          {{ store.pendingCount }}
        </span>
      </button>
    </nav>

    <!-- Asignaciones: 3 columns -->
    <div v-if="activeTab === 'asignaciones'" class="cv__grid">
      <CaseQueue />
      <WddEvaluationPanel />
      <SpecialistsSidebar />
    </div>

    <!-- Crear caso -->
    <div v-else-if="activeTab === 'crear'" class="cv__scroll">
      <CaseCreateForm />
    </div>

    <!-- Cargas -->
    <div v-else class="cv__scroll">
      <CaseLoadsView />
    </div>
  </div>
</template>

<style scoped>
.cv {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-main);
}

/* Tabs */
.cv__tabs {
  display: flex;
  border-bottom: 1px solid var(--border-light);
  padding: 0 1rem;
  flex-shrink: 0;
}

.cv__tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}

.cv__tab:hover { color: var(--text-primary); }

.cv__tab--active {
  color: var(--primary-500);
  border-bottom-color: var(--primary-500);
}

.cv__tab-icon { font-size: 0.95rem; }

.cv__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--priority-p1);
  color: white;
  border-radius: var(--radius-full);
  font-size: 0.6rem;
  font-weight: 700;
}

/* 3-column grid */
.cv__grid {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  flex: 1;
  overflow: hidden;
}

/* Scrollable tab content */
.cv__scroll {
  flex: 1;
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 1200px) {
  .cv__grid { grid-template-columns: 240px 1fr 260px; }
}

@media (max-width: 1024px) {
  .cv__grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

@media (max-width: 768px) {
  .cv__tabs { overflow-x: auto; }
  .cv__tab { white-space: nowrap; padding: 0.6rem 0.75rem; font-size: 0.78rem; }
}
</style>

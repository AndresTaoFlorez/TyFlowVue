<script setup>
import { ref, onMounted } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCasesRealtime } from '@/presentation/composables/useCasesRealtime'
import CaseFiltersBar from '@/presentation/components/CaseFiltersBar.vue'
import CaseListTable from '@/presentation/components/CaseListTable.vue'
import CaseLoadsView from '@/presentation/components/CaseLoadsView.vue'
import CaseDetailModal from '@/presentation/components/CaseDetailModal.vue'
import CaseCreateModal from '@/presentation/components/CaseCreateModal.vue'

const store = useCasesStore()
const userStore = useUserStore()
const activeTab = ref('lista')

const tabs = [
  { id: 'lista', label: 'Lista', icon: 'bx-list-ul' },
  { id: 'cargas', label: 'Cargas', icon: 'bx-bar-chart-alt-2' },
]

useCasesRealtime()

onMounted(async () => {
  await userStore.loadSelects()
  await store.loadCases()
})
</script>

<template>
  <div class="cv">
    <!-- Tabs + create button -->
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
        <span v-if="tab.id === 'lista' && store.caseCount" class="cv__tab-badge">
          {{ store.caseCount }}
        </span>
      </button>

      <button class="cv__create-btn" @click="store.showCreateModal = true">
        <i class="bx bx-plus"></i>
        <span class="cv__create-label">Nuevo caso</span>
      </button>
    </nav>

    <!-- Lista: filters + table -->
    <template v-if="activeTab === 'lista'">
      <CaseFiltersBar />
      <CaseListTable />
    </template>

    <!-- Cargas -->
    <div v-else class="cv__scroll">
      <CaseLoadsView />
    </div>

    <!-- Modals -->
    <CaseDetailModal v-if="store.showDetailModal" />
    <CaseCreateModal v-if="store.showCreateModal" />
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
  align-items: center;
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
  background: var(--primary-500);
  color: white;
  border-radius: var(--radius-full);
  font-size: 0.6rem;
  font-weight: 700;
}

/* Create button */
.cv__create-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
  padding: 0.4rem 0.75rem;
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}
.cv__create-btn:hover { background: var(--primary-600); }
.cv__create-btn i { font-size: 1rem; }

/* Scrollable tab content */
.cv__scroll {
  flex: 1;
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 768px) {
  .cv__tabs { overflow-x: auto; }
  .cv__tab { white-space: nowrap; padding: 0.6rem 0.75rem; font-size: 0.78rem; }
  .cv__create-label { display: none; }
  .cv__create-btn { padding: 0.4rem; }
}
</style>

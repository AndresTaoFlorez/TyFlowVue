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

async function runAutopilot() {
  try {
    await store.triggerAutopilot()
  } catch (e) {
    // 409 or other — store doesn't set actionError for autopilot, show alert
    alert(e.message || 'Error lanzando autopilot')
  }
}

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

      <!-- Right-side actions -->
      <div class="cv__tabs-end">
        <!-- Autopilot progress pill -->
        <div v-if="store.autopilotState.running" class="cv__autopilot-pill">
          <i class="bx bx-loader-alt bx-spin"></i>
          <span v-if="store.autopilotState.total">
            {{ store.autopilotState.processed }}/{{ store.autopilotState.total }}
          </span>
          <span v-else>Autopilot...</span>
        </div>

        <!-- Autopilot trigger button -->
        <button
          class="cv__autopilot-btn"
          :disabled="store.autopilotState.running"
          :title="store.autopilotState.running ? 'Autopilot en progreso' : 'Lanzar WDD Autopilot'"
          @click="runAutopilot"
        >
          <i class="bx bx-bot"></i>
          <span class="cv__create-label">Autopilot</span>
        </button>

        <button class="cv__create-btn" @click="store.showCreateModal = true">
          <i class="bx bx-plus"></i>
          <span class="cv__create-label">Nuevo caso</span>
        </button>
      </div>
    </nav>

    <!-- Lista: filters + table -->
    <div v-show="activeTab === 'lista'" class="cv__lista">
      <CaseFiltersBar />
      <CaseListTable />
    </div>

    <!-- Cargas -->
    <div v-show="activeTab === 'cargas'" class="cv__scroll">
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

/* Right-side tab actions group */
.cv__tabs-end {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

/* Autopilot */
.cv__autopilot-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.cv__autopilot-btn:hover:not(:disabled) { border-color: var(--primary-500); color: var(--primary-500); }
.cv__autopilot-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.cv__autopilot-btn i { font-size: 1rem; }

.cv__autopilot-pill {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  background: rgba(42, 199, 143, 0.1);
  border: 1px solid rgba(42, 199, 143, 0.3);
  border-radius: var(--radius-full);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--primary-600);
  white-space: nowrap;
}
.cv__autopilot-pill i { font-size: 0.8rem; }

/* Create button */
.cv__create-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
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

/* Tab content panels */
.cv__lista {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

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

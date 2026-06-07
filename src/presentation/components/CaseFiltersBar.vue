<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'

const store = useCasesStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const statuses = [
  { routeStatus: 'todos',       label: 'Todos' },
  { routeStatus: 'open',        label: 'Abiertos' },
  { routeStatus: 'assigned',    label: 'Asignados' },
  { routeStatus: 'in_progress', label: 'En progreso' },
  { routeStatus: 'resolved',    label: 'Resueltos' },
  { routeStatus: 'closed',      label: 'Cerrados' },
]

const origins = [
  { value: 'outlook', label: 'Outlook' },
  { value: 'judit', label: 'Judit' },
  { value: 'tyflow', label: 'TyFlow' },
]

const priorities = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

const applications = computed(() => userStore.applications ?? [])

function setStatusFilter(routeStatus) {
  store.clearSearch()
  router.push({ name: 'casos-list', params: { status: routeStatus } })
}

function setFilter(key, value) {
  store.loadCases({ [key]: value })
}

// ── Search ────────────────────────────────────────────
let _searchTimer = null

function onSearchInput(val) {
  store.searchQuery = val
  store.searchError = null
  clearTimeout(_searchTimer)
  _searchTimer = setTimeout(() => {
    store.filterCasesLocally(val)
  }, 220)
}

function doSearch() {
  clearTimeout(_searchTimer)
  store.searchCases(store.searchQuery)
}

function clearSearch() {
  clearTimeout(_searchTimer)
  store.clearSearch()
}
</script>

<template>
  <div class="fb">
    <!-- Status chips (router-driven) -->
    <div class="fb__group">
      <button
        v-for="s in statuses"
        :key="s.routeStatus"
        class="fb__chip"
        :class="{ 'fb__chip--active': route.params.status === s.routeStatus && !store.searchMode }"
        @click="setStatusFilter(s.routeStatus)"
      >{{ s.label }}</button>
    </div>

    <div class="fb__sep"></div>

    <!-- Origin -->
    <select class="fb__select" :value="store.filters.originType" @change="setFilter('originType', $event.target.value || null)">
      <option value="">Origen: Todos</option>
      <option v-for="o in origins" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>

    <!-- Priority -->
    <select class="fb__select" :value="store.filters.priority" @change="setFilter('priority', $event.target.value || null)">
      <option value="">Prioridad: Todas</option>
      <option v-for="p in priorities" :key="p.value" :value="p.value">{{ p.label }}</option>
    </select>

    <!-- Application -->
    <select class="fb__select" :value="store.filters.applicationId" @change="setFilter('applicationId', $event.target.value || null)">
      <option value="">Aplicación: Todas</option>
      <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
    </select>

    <!-- Search input -->
    <div class="fb__search" :class="{ 'fb__search--active': store.searchMode, 'fb__search--error': store.searchError && !store.searchLoading }">
      <i class="bx bx-search fb__search-icon"></i>
      <input
        :value="store.searchQuery"
        class="fb__search-input"
        type="text"
        placeholder="Buscar por ID..."
        maxlength="36"
        @input="onSearchInput($event.target.value)"
        @keydown.enter.prevent="doSearch"
        @keydown.escape="clearSearch"
      />
      <i v-if="store.searchLoading" class="bx bx-loader-alt bx-spin fb__search-spinner"></i>
      <button v-else-if="store.searchQuery" class="fb__search-clear" tabindex="-1" @click="clearSearch">
        <i class="bx bx-x"></i>
      </button>
      <!-- Error tooltip -->
      <span v-if="store.searchError" class="fb__search-tip">{{ store.searchError }}</span>
    </div>

    <!-- Count (shows search results count when in search mode) -->
    <span v-if="store.searchMode" class="fb__count fb__count--search">
      <i class="bx bx-search" style="font-size:0.7rem"></i>
      {{ store.searchResults.length }} resultado{{ store.searchResults.length !== 1 ? 's' : '' }}
    </span>
    <span v-else-if="store.caseCount > 0" class="fb__count">
      {{ store.caseCount }} caso{{ store.caseCount !== 1 ? 's' : '' }}
    </span>
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
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.65rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
}
.fb__count--search {
  border-color: var(--primary-500);
  color: var(--primary-600, #1fa672);
  background: rgba(42,199,143,0.06);
}

/* ── Search ── */
.fb__search {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-main);
  padding: 0 0.35rem;
  gap: 0.2rem;
  height: 28px;
  width: 170px;
  flex-shrink: 0;
  transition: border-color 0.12s;
}
.fb__search:focus-within { border-color: var(--primary-500); }
.fb__search--active { border-color: var(--primary-500); background: rgba(42,199,143,0.04); }
.fb__search--error { border-color: var(--error, #e53e3e); }

.fb__search-icon {
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex-shrink: 0;
  pointer-events: none;
}

.fb__search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.72rem;
  color: var(--text-primary);
  min-width: 0;
  font-family: inherit;
}
.fb__search-input::placeholder { color: var(--text-secondary); opacity: 0.6; }

.fb__search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
}
.fb__search-clear:hover { color: var(--text-primary); }

.fb__search-spinner {
  font-size: 0.85rem;
  color: var(--primary-500);
  flex-shrink: 0;
}

.fb__search-tip {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--error, #e53e3e);
  border-radius: var(--radius-md);
  font-size: 0.68rem;
  color: var(--error, #e53e3e);
  padding: 0.2rem 0.45rem;
  white-space: nowrap;
  z-index: 10;
  pointer-events: none;
}

@media (max-width: 768px) {
  .fb { gap: 0.35rem; padding: 0.6rem 0.75rem; }
  .fb__group { overflow-x: auto; flex-shrink: 0; }
  .fb__sep { display: none; }
  .fb__search { width: 140px; }
}
</style>

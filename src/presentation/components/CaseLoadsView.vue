<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'

const store = useCasesStore()
const userStore = useUserStore()

const viewMode = ref('columns') // 'columns' | 'table'
const filterApp = ref('')
const MAX_LOAD = 10

const applications = computed(() => userStore.applications ?? [])
const workloads = computed(() => store.specialistWorkloads)

function loadPct(count) {
  return Math.min(100, Math.round(((count ?? 0) / MAX_LOAD) * 100))
}

function loadColor(pct) {
  if (pct < 60) return 'var(--load-low)'
  if (pct < 85) return 'var(--load-mid)'
  return 'var(--load-high)'
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function hslColor(name) {
  let h = 0
  for (const ch of (name || '')) h = ch.charCodeAt(0) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 50%, 42%)`
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

// Reload workloads when filter changes
watch(filterApp, (appId) => {
  if (appId) store.loadWorkloads(appId)
})

onMounted(() => {
  if (!filterApp.value && applications.value.length > 0) {
    filterApp.value = applications.value[0].id
  }
})
</script>

<template>
  <div class="lv">
    <!-- Header -->
    <div class="lv__header">
      <h3 class="lv__title">Cargas actuales</h3>
      <div class="lv__controls">
        <select v-model="filterApp" class="lv__filter">
          <option value="">Todas las apps</option>
          <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
        </select>
        <div class="lv__toggle">
          <button class="lv__toggle-btn" :class="{ 'lv__toggle-btn--on': viewMode === 'columns' }" @click="viewMode = 'columns'">
            <i class="bx bx-grid-alt"></i>
          </button>
          <button class="lv__toggle-btn" :class="{ 'lv__toggle-btn--on': viewMode === 'table' }" @click="viewMode = 'table'">
            <i class="bx bx-list-ul"></i>
          </button>
        </div>
      </div>
    </div>

    <div v-if="workloads.length === 0" class="lv__empty">
      <i class="bx bx-user-x"></i>
      <p>No hay datos de carga para esta aplicación</p>
    </div>

    <!-- Column view -->
    <div v-else-if="viewMode === 'columns'" class="lv__grid">
      <div v-for="s in workloads" :key="s.specialist_id" class="lc">
        <div class="lc__head">
          <div class="lc__avatar" :style="{ background: hslColor(s.full_name) }">{{ initials(s.full_name) }}</div>
          <div class="lc__info">
            <span class="lc__name">{{ s.full_name }}</span>
            <span class="lc__avail" :class="s.is_available ? 'lc__avail--on' : 'lc__avail--off'">
              <i class="bx bxs-circle"></i>
              {{ s.is_available ? 'Disponible' : 'Sin ventana' }}
            </span>
          </div>
        </div>

        <div class="lc__bar-wrap">
          <div class="lc__bar-bg">
            <div class="lc__bar-fill" :style="{ width: loadPct(s.current_count) + '%', background: loadColor(loadPct(s.current_count)) }"></div>
          </div>
          <span class="lc__bar-label" :style="{ color: loadColor(loadPct(s.current_count)) }">
            {{ s.current_count ?? 0 }}/{{ MAX_LOAD }}
          </span>
        </div>

        <div class="lc__meta">
          <span v-if="s.window_starts_at" class="lc__window">
            <i class="bx bx-time-five"></i> {{ fmtTime(s.window_starts_at) }} – {{ fmtTime(s.window_ends_at) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Table view -->
    <div v-else class="lv__table-wrap">
      <table class="lv__table">
        <thead>
          <tr>
            <th>Especialista</th>
            <th>Disponible</th>
            <th>Carga</th>
            <th>Casos</th>
            <th>Ventana</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in workloads" :key="s.specialist_id">
            <td>
              <div class="lv__table-spec">
                <div class="lc__avatar lc__avatar--sm" :style="{ background: hslColor(s.full_name) }">{{ initials(s.full_name) }}</div>
                {{ s.full_name }}
              </div>
            </td>
            <td>
              <span class="lv__avail-badge" :class="s.is_available ? 'lv__avail-badge--on' : 'lv__avail-badge--off'">
                {{ s.is_available ? 'Sí' : 'No' }}
              </span>
            </td>
            <td>
              <div class="lv__table-bar">
                <div class="lc__bar-bg" style="width:70px">
                  <div class="lc__bar-fill" :style="{ width: loadPct(s.current_count) + '%', background: loadColor(loadPct(s.current_count)) }"></div>
                </div>
              </div>
            </td>
            <td>{{ s.current_count ?? 0 }}/{{ MAX_LOAD }}</td>
            <td>
              <template v-if="s.window_starts_at">{{ fmtTime(s.window_starts_at) }} – {{ fmtTime(s.window_ends_at) }}</template>
              <span v-else class="lv__table-na">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.lv { padding: 1.25rem; }

.lv__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.lv__title { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); }

.lv__controls { display: flex; align-items: center; gap: 0.65rem; }

.lv__filter {
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  color: var(--text-primary);
  background: var(--bg-main);
}

.lv__toggle {
  display: flex;
  gap: 0.15rem;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 0.15rem;
}

.lv__toggle-btn {
  padding: 0.3rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition: all 0.12s;
}

.lv__toggle-btn--on {
  background: var(--bg-main);
  color: var(--primary-600);
  box-shadow: var(--shadow-sm);
}

.lv__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  padding: 3rem;
  font-size: 0.88rem;
}
.lv__empty i { font-size: 2rem; opacity: 0.35; }

/* Column grid */
.lv__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.85rem;
}

.lc {
  background: var(--bg-main);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.lc__head { display: flex; align-items: center; gap: 0.55rem; }

.lc__avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 0.68rem; font-weight: 700;
  flex-shrink: 0;
}
.lc__avatar--sm { width: 28px; height: 28px; font-size: 0.6rem; }

.lc__info { display: flex; flex-direction: column; min-width: 0; }
.lc__name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.lc__avail { font-size: 0.65rem; display: flex; align-items: center; gap: 0.2rem; }
.lc__avail i { font-size: 0.45rem; }
.lc__avail--on { color: var(--load-low); }
.lc__avail--off { color: var(--load-high); }

.lc__bar-wrap { display: flex; align-items: center; gap: 0.5rem; }

.lc__bar-bg {
  flex: 1;
  height: 6px;
  background: var(--border-light);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.lc__bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.4s;
}

.lc__bar-label { font-size: 0.72rem; font-weight: 700; min-width: 28px; text-align: right; }

.lc__meta { font-size: 0.68rem; color: var(--text-secondary); }
.lc__meta i { font-size: 0.72rem; vertical-align: -1px; margin-right: 0.1rem; }

/* Table */
.lv__table-wrap { overflow-x: auto; }

.lv__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.lv__table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-light);
  white-space: nowrap;
}

.lv__table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
}

.lv__table-spec { display: flex; align-items: center; gap: 0.5rem; }

.lv__avail-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-full);
}
.lv__avail-badge--on { background: var(--success-bg); color: var(--success-text); }
.lv__avail-badge--off { background: var(--error-bg); color: var(--error-text); }

.lv__table-bar { display: flex; align-items: center; }
.lv__table-na { color: var(--text-secondary); }
</style>

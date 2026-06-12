<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import SpecialistDashCard from '@/presentation/components/cases/SpecialistDashCard.vue'
import SpecialistDetailPanel from '@/presentation/components/cases/SpecialistDetailPanel.vue'
import CaseLoadsView from '@/presentation/components/cases/CaseLoadsView.vue'

// Vista fusionada de Especialistas:
//  - modo dashboard (default): cards modulares con cargas reales por especialista
//    + panel expandible a la derecha con historial de ventanas/casos.
//  - modo columnas (rutas cases-loads*): el triaje de 3 paneles (ex "Cargas").
const store = useCasesStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const viewMode = computed(() =>
  route.name?.startsWith('cases-loads') ? 'columns' : 'dashboard'
)

const sortBy = ref('load')     // 'load' | 'name'
const turnoOnly = ref(false)

// ── Specialist aggregation ────────────────────────────
// allWorkloads: una fila por (especialista, app) con su ventana activa.
// activeCounts/activeAssignments: asignaciones activas reales (fuente de contadores).
const specialists = computed(() => {
  const map = new Map()
  for (const w of store.allWorkloads) {
    if (!map.has(w.specialist_id)) {
      map.set(w.specialist_id, {
        specialist_id: w.specialist_id,
        full_name: w.full_name,
        is_available: !!w.is_available,
        windows: [],
      })
    }
    const s = map.get(w.specialist_id)
    if (w.is_available) s.is_available = true
    s.windows.push({
      appId: w.application_id,
      appName: userStore.applications?.find(a => a.id === w.application_id)?.name ?? '—',
      startsAt: w.window_starts_at,
      endsAt: w.window_ends_at,
    })
  }
  // Especialistas con casos activos pero sin ventana vigente también cuentan
  for (const sid of Object.keys(store.activeCounts)) {
    if (map.has(sid) || !store.activeCounts[sid]) continue
    const u = userStore.users.find(u => u.specialistId === sid)
    map.set(sid, {
      specialist_id: sid,
      full_name: u?.fullName ?? 'Especialista',
      is_available: false,
      windows: [],
    })
  }

  const todayKey = new Date().toISOString().slice(0, 10)
  const assignmentsBySpec = new Map()
  for (const a of store.activeAssignments) {
    if (!assignmentsBySpec.has(a.specialistId)) assignmentsBySpec.set(a.specialistId, [])
    assignmentsBySpec.get(a.specialistId).push(a)
  }

  return [...map.values()].map(s => {
    const assignments = assignmentsBySpec.get(s.specialist_id) ?? []
    return {
      ...s,
      activeCount: store.activeCounts[s.specialist_id] ?? 0,
      todayCount: assignments.filter(a => a.assignedAt?.slice(0, 10) === todayKey).length,
      assignments,
    }
  })
})

const rows = computed(() => {
  let list = [...specialists.value]
  if (turnoOnly.value) list = list.filter(s => s.is_available)
  list.sort((a, b) => {
    if (sortBy.value === 'load') {
      if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount
      return (a.full_name || '').localeCompare(b.full_name || '')
    }
    return (a.full_name || '').localeCompare(b.full_name || '')
  })
  return list
})

// ── KPIs (sin capacidades inventadas) ─────────────────
const kpis = computed(() => {
  const all = specialists.value
  const conTurno = all.filter(s => s.is_available).length
  const totalActive = all.reduce((n, s) => n + s.activeCount, 0)
  const hoy = all.reduce((n, s) => n + s.todayCount, 0)
  const top = [...all].sort((a, b) => b.activeCount - a.activeCount)[0]
  return {
    conTurno,
    total: all.length,
    totalActive,
    hoy,
    topName: top && top.activeCount > 0 ? top.full_name : null,
    topCount: top?.activeCount ?? 0,
  }
})

// ── Detail panel (route-driven) ───────────────────────
const expandedSpecialistId = computed(() =>
  route.name === 'cases-specialist-detail' ? route.params.specialistId : null
)

const expandedSpecialistName = computed(() => {
  const sid = expandedSpecialistId.value
  if (!sid) return ''
  return specialists.value.find(s => s.specialist_id === sid)?.full_name
    ?? userStore.users.find(u => u.specialistId === sid)?.fullName
    ?? 'Especialista'
})

function expandSpecialist(specialistId) {
  router.push({ name: 'cases-specialist-detail', params: { specialistId } })
}

function closePanel() {
  router.push({ name: 'cases-specialists' })
}

function openCase(caseId) {
  store.openDetailById(caseId)
}

function preferencesFor(specialistId) {
  return userStore.users.find(u => u.specialistId === specialistId)?.preferences ?? null
}

// ── Mode toggle ───────────────────────────────────────
function setMode(mode) {
  if (mode === viewMode.value) return
  router.push({ name: mode === 'columns' ? 'cases-loads' : 'cases-specialists' })
}

// ── Data load ─────────────────────────────────────────
const loading = computed(() => store.loadingAllWorkloads || store.loadingActiveCounts)

async function fetchAll() {
  const apps = userStore.applications
  await Promise.all([
    apps.length ? store.loadAllWorkloads(apps.map(a => a.id)) : Promise.resolve(),
    store.loadActiveCounts(),
  ])
}

onMounted(() => {
  if (userStore.applications.length) {
    fetchAll()
  } else {
    // Observar length: replaceAll puede mutar el array in-place y un watcher
    // sobre la referencia no dispararía.
    const stop = watch(() => userStore.applications.length, (n) => {
      if (n) { stop(); fetchAll() }
    })
  }
})
</script>

<template>
  <div class="esv">
    <!-- ══ Columns mode (ex Cargas) ══ -->
    <CaseLoadsView v-if="viewMode === 'columns'" />

    <!-- ══ Dashboard mode ══ -->
    <div v-else class="esv__layout">
      <div class="esv__main">
        <!-- Toolbar -->
        <div class="esv__toolbar">
          <div class="esv__seg">
            <button :class="['esv__seg-btn', sortBy === 'load' && 'esv__seg-btn--active']" @click="sortBy = 'load'">
              <i class="bx bx-sort-down"></i> Carga
            </button>
            <button :class="['esv__seg-btn', sortBy === 'name' && 'esv__seg-btn--active']" @click="sortBy = 'name'">
              <i class="bx bx-sort-a-z"></i> Nombre
            </button>
          </div>
          <button :class="['esv__chip', turnoOnly && 'esv__chip--active']" @click="turnoOnly = !turnoOnly">
            <i class="bx bx-time-five"></i> Solo con turno
          </button>
          <button class="esv__refresh" :disabled="loading" title="Actualizar" @click="fetchAll">
            <i class="bx bx-refresh" :class="{ 'esv__spin': loading }"></i>
          </button>
        </div>

        <!-- KPIs -->
        <div class="esv__kpis">
          <div class="esv__kpi">
            <div class="esv__kpi-label"><i class="bx bx-group"></i>Especialistas</div>
            <div class="esv__kpi-val">{{ kpis.conTurno }}<span class="esv__kpi-sub-inline"> / {{ kpis.total }}</span></div>
            <div class="esv__kpi-sub">con turno vigente</div>
          </div>
          <div class="esv__kpi">
            <div class="esv__kpi-label"><i class="bx bx-folder-open"></i>Casos activos</div>
            <div class="esv__kpi-val">{{ kpis.totalActive }}</div>
            <div class="esv__kpi-sub">asignaciones vigentes</div>
          </div>
          <div class="esv__kpi">
            <div class="esv__kpi-label"><i class="bx bx-calendar-check"></i>Hoy</div>
            <div class="esv__kpi-val">{{ kpis.hoy }}</div>
            <div class="esv__kpi-sub">asignados hoy</div>
          </div>
          <div class="esv__kpi">
            <div class="esv__kpi-label"><i class="bx bx-trending-up"></i>Mayor carga</div>
            <div class="esv__kpi-val esv__kpi-val--name">{{ kpis.topName ?? '—' }}</div>
            <div class="esv__kpi-sub">{{ kpis.topName ? kpis.topCount + ' casos activos' : 'sin casos activos' }}</div>
          </div>
        </div>

        <!-- Cards grid -->
        <div class="esv__scroll">
          <div v-if="loading && rows.length === 0" class="esv__empty">
            <i class="bx bx-loader-alt bx-spin"></i>
            <div class="esv__empty-title">Cargando especialistas...</div>
          </div>
          <div v-else-if="rows.length === 0" class="esv__empty">
            <i class="bx bx-group"></i>
            <div class="esv__empty-title">Sin especialistas</div>
            <div class="esv__empty-sub">No hay especialistas con ventanas vigentes ni casos activos.</div>
          </div>
          <div v-else class="esv__grid" :class="{ 'esv__grid--narrow': expandedSpecialistId }">
            <SpecialistDashCard
              v-for="s in rows"
              :key="s.specialist_id"
              :specialist="s"
              :preferences="preferencesFor(s.specialist_id)"
              @expand="expandSpecialist"
              @open-case="openCase"
            />
          </div>
        </div>
      </div>

      <!-- Panel expandido a la derecha -->
      <SpecialistDetailPanel
        v-if="expandedSpecialistId"
        class="esv__panel"
        :specialist-id="expandedSpecialistId"
        :specialist-name="expandedSpecialistName"
        @close="closePanel"
        @open-case="openCase"
      />
    </div>
  </div>
</template>

<style scoped>
.esv {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.esv__layout {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.esv__main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 1.1rem 1.25rem 0;
}

.esv__panel {
  width: 420px;
  flex-shrink: 0;
}

/* ── Toolbar ── */
.esv__toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.esv__seg {
  display: flex;
  height: 34px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-card);
}

.esv__seg-btn {
  padding: 0 0.7rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.esv__seg-btn + .esv__seg-btn { border-left: 1px solid var(--border-light); }
.esv__seg-btn:hover { color: var(--text-primary); background: var(--bg-main); }
.esv__seg-btn--active { background: var(--primary-500); color: #fff; }
.esv__seg-btn--active:hover { background: var(--primary-600); color: #fff; }

.esv__chip {
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.14s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.esv__chip i { font-size: 0.8rem; }
.esv__chip:hover { color: var(--text-primary); border-color: var(--primary-500); }
.esv__chip--active { background: var(--primary-500); border-color: var(--primary-500); color: #fff; }
.esv__chip--active:hover { background: var(--primary-600); color: #fff; }

.esv__refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-left: auto;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.12s;
}
.esv__refresh:hover:not(:disabled) { color: var(--primary-500); border-color: var(--primary-500); }
.esv__refresh:disabled { opacity: 0.6; cursor: default; }

@keyframes esv-spin { to { transform: rotate(360deg); } }
.esv__spin { animation: esv-spin 0.8s linear infinite; }

/* ── KPIs ── */
.esv__kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
  margin-bottom: 1.1rem;
  flex-shrink: 0;
}

.esv__kpi {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  min-width: 0;
}

.esv__kpi-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.esv__kpi-label i { font-size: 0.95rem; }

.esv__kpi-val {
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 0.3rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.esv__kpi-val--name { font-size: 1.05rem; line-height: 1.6; }

.esv__kpi-sub-inline {
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.esv__kpi-sub {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

/* ── Cards grid ── */
.esv__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 1.25rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border-light) transparent;
}

.esv__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 1rem;
}
.esv__grid--narrow {
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
}

/* ── Empty state ── */
.esv__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 5rem 1rem;
  color: var(--text-secondary);
}
.esv__empty i { font-size: 2.4rem; opacity: 0.5; }
.esv__empty-title { font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); }
.esv__empty-sub { font-size: 0.8rem; }

/* ── Responsive ── */
@media (max-width: 1100px) {
  .esv__panel {
    position: fixed;
    top: var(--topbar-height, 68px);
    right: 0;
    bottom: 0;
    z-index: 150;
    width: min(420px, 100vw);
    box-shadow: -8px 0 32px rgba(8, 14, 30, 0.25);
  }
}

@media (max-width: 960px) {
  .esv__kpis { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .esv__kpis { grid-template-columns: 1fr; }
  .esv__grid { grid-template-columns: 1fr; }
}
</style>

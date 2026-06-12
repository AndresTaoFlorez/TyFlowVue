<script setup>
import { ref, computed, watch } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { fetchWorkWindowsPageUseCase } from '@/application/use-cases/work-windows/FetchWorkWindowsPageUseCase'
import { fetchAssignmentsUseCase } from '@/application/use-cases/assignments/FetchAssignmentsUseCase'
import { fetchAssignmentTotalUseCase } from '@/application/use-cases/assignments/FetchAssignmentTotalUseCase'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'

// Panel expandido de un especialista: historial de ventanas de trabajo
// (estilo changelog, paginado de más reciente a más antiguo) con cuántos
// casos recibió en cada una, y mini-lista de casos por ventana.
const props = defineProps({
  specialistId: { type: String, required: true },
  specialistName: { type: String, default: '' },
})

const emit = defineEmits(['close', 'open-case'])

const store = useCasesStore()
const userStore = useUserStore()

// ── Period filter ─────────────────────────────────────
const PERIODS = [
  { id: 'this_week',  label: 'Semana' },
  { id: 'this_month', label: 'Mes' },
  { id: 'all',        label: 'Todo' },
]
const period = ref('this_week')

// ── Windows (paginadas desc sobre una API asc) ───────
const WIN_PAGE_SIZE = 50
const windows = ref([])          // ordenadas desc (más reciente primero)
const windowsTotal = ref(0)
const oldestLoadedPage = ref(0)  // página asc más antigua ya cargada
const loadingWindows = ref(false)
const expandedWindowId = ref(null)

// ── Assignments (para conteos por ventana) ───────────
const ASSIGN_PAGE_SIZE = 500
const ASSIGN_MAX_PAGES = 2
const assignments = ref([])
const assignmentsTotal = ref(0)
const loadingAssignments = ref(false)

// ── Totales ──────────────────────────────────────────
const totalHistorico = ref(null)

const activeCount = computed(() => store.activeCounts[props.specialistId] ?? 0)

const byWindow = computed(() => {
  const map = new Map()
  for (const a of assignments.value) {
    if (!a.workWindowId) continue
    if (!map.has(a.workWindowId)) map.set(a.workWindowId, [])
    map.get(a.workWindowId).push(a)
  }
  return map
})

const assignmentsTruncated = computed(() =>
  assignmentsTotal.value > assignments.value.length
)

const hasOlderWindows = computed(() => oldestLoadedPage.value > 1)

const userPreferences = computed(() =>
  userStore.users.find(u => u.specialistId === props.specialistId)?.preferences ?? null
)

function hslColor(name) {
  let h = 0
  for (const ch of (name || '')) h = ch.charCodeAt(0) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 50%, 42%)`
}

function appName(id) {
  return userStore.applications?.find(a => a.id === id)?.name ?? '—'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Loaders ──────────────────────────────────────────

// La API ordena asc por starts_at: para mostrar "más reciente primero" con
// paginado honesto, se carga la ÚLTIMA página y "cargar más" retrocede.
async function loadWindows() {
  loadingWindows.value = true
  windows.value = []
  expandedWindowId.value = null
  try {
    const first = await fetchWorkWindowsPageUseCase({
      specialist_id: props.specialistId,
      period: period.value,
      page: 1,
      page_size: WIN_PAGE_SIZE,
    })
    windowsTotal.value = first.total
    const lastPage = Math.max(1, Math.ceil(first.total / WIN_PAGE_SIZE))
    if (lastPage === 1) {
      windows.value = [...first.data].reverse()
      oldestLoadedPage.value = 1
    } else {
      const last = await fetchWorkWindowsPageUseCase({
        specialist_id: props.specialistId,
        period: period.value,
        page: lastPage,
        page_size: WIN_PAGE_SIZE,
      })
      windows.value = [...last.data].reverse()
      oldestLoadedPage.value = lastPage
    }
  } catch { /* silent */ }
  finally { loadingWindows.value = false }
}

async function loadOlderWindows() {
  if (!hasOlderWindows.value || loadingWindows.value) return
  loadingWindows.value = true
  try {
    const page = oldestLoadedPage.value - 1
    const res = await fetchWorkWindowsPageUseCase({
      specialist_id: props.specialistId,
      period: period.value,
      page,
      page_size: WIN_PAGE_SIZE,
    })
    windows.value = [...windows.value, ...[...res.data].reverse()]
    oldestLoadedPage.value = page
  } catch { /* silent */ }
  finally { loadingWindows.value = false }
}

async function loadAssignments() {
  loadingAssignments.value = true
  assignments.value = []
  try {
    let page = 1
    let all = []
    let total = 0
    do {
      const res = await fetchAssignmentsUseCase({
        specialistId: props.specialistId,
        page,
        pageSize: ASSIGN_PAGE_SIZE,
      })
      all = all.concat(res.data)
      total = res.total
      page++
    } while (all.length < total && page <= ASSIGN_MAX_PAGES)
    assignments.value = all
    assignmentsTotal.value = total
  } catch { /* silent */ }
  finally { loadingAssignments.value = false }
}

async function loadTotals() {
  totalHistorico.value = null
  try {
    totalHistorico.value = await fetchAssignmentTotalUseCase(props.specialistId)
  } catch { /* silent */ }
}

function toggleWindow(id) {
  expandedWindowId.value = expandedWindowId.value === id ? null : id
}

watch(() => props.specialistId, () => {
  loadWindows()
  loadAssignments()
  loadTotals()
}, { immediate: true })

watch(period, loadWindows)
</script>

<template>
  <aside class="sdp">
    <!-- Header -->
    <div class="sdp__header">
      <UserAvatar
        :preferences="userPreferences"
        :name="specialistName"
        :bg-color="hslColor(specialistName)"
        size="36px"
        class="sdp__avatar"
      />
      <div class="sdp__head-info">
        <span class="sdp__name">{{ specialistName }}</span>
        <span class="sdp__sub">Detalle de cargas</span>
      </div>
      <button class="sdp__close" title="Cerrar panel" @click="emit('close')">
        <i class="bx bx-x"></i>
      </button>
    </div>

    <!-- KPI strip -->
    <div class="sdp__kpis">
      <div class="sdp__kpi">
        <span class="sdp__kpi-num">{{ activeCount }}</span>
        <span class="sdp__kpi-label">activos</span>
      </div>
      <div class="sdp__kpi">
        <span class="sdp__kpi-num">{{ totalHistorico ?? '…' }}</span>
        <span class="sdp__kpi-label">histórico</span>
      </div>
      <div class="sdp__kpi">
        <span class="sdp__kpi-num">{{ windowsTotal }}</span>
        <span class="sdp__kpi-label">ventanas ({{ PERIODS.find(p => p.id === period)?.label.toLowerCase() }})</span>
      </div>
    </div>

    <!-- Period selector -->
    <div class="sdp__periods">
      <button
        v-for="p in PERIODS"
        :key="p.id"
        class="sdp__period-btn"
        :class="{ 'sdp__period-btn--active': period === p.id }"
        @click="period = p.id"
      >{{ p.label }}</button>
    </div>

    <!-- Windows changelog -->
    <div class="sdp__scroll">
      <div v-if="loadingWindows && windows.length === 0" class="sdp__placeholder">
        <i class="bx bx-loader-alt bx-spin"></i> Cargando ventanas...
      </div>
      <div v-else-if="windows.length === 0" class="sdp__placeholder">
        <i class="bx bx-calendar-x"></i> Sin ventanas en este periodo
      </div>

      <template v-else>
        <div
          v-for="w in windows"
          :key="w.id"
          class="sdp__win"
          :class="{ 'sdp__win--expanded': expandedWindowId === w.id, 'sdp__win--active': w.isActive }"
        >
          <!-- Window row -->
          <button class="sdp__win-row" @click="toggleWindow(w.id)">
            <div class="sdp__win-rail">
              <span class="sdp__win-dot" :class="{ 'sdp__win-dot--active': w.isActive }"></span>
            </div>
            <div class="sdp__win-main">
              <div class="sdp__win-top">
                <span class="sdp__win-date">{{ fmtDate(w.startsAt) }}</span>
                <span v-if="w.isActive" class="sdp__win-live">VIGENTE</span>
              </div>
              <div class="sdp__win-meta">
                <span class="sdp__win-time">
                  <i class="bx bx-time-five"></i>
                  {{ fmtTime(w.startsAt) }} – {{ fmtTime(w.endsAt) }}
                </span>
                <span class="sdp__win-app">{{ appName(w.applicationId) }}</span>
              </div>
            </div>
            <div class="sdp__win-count" :class="{ 'sdp__win-count--zero': !(byWindow.get(w.id)?.length) }">
              <span class="sdp__win-count-num">{{ byWindow.get(w.id)?.length ?? 0 }}</span>
              <span class="sdp__win-count-label">caso{{ (byWindow.get(w.id)?.length ?? 0) !== 1 ? 's' : '' }}</span>
            </div>
            <i class="bx sdp__win-caret" :class="expandedWindowId === w.id ? 'bx-chevron-up' : 'bx-chevron-down'"></i>
          </button>

          <!-- Expanded: cases received in this window -->
          <div v-if="expandedWindowId === w.id" class="sdp__cases">
            <div v-if="loadingAssignments" class="sdp__cases-empty">
              <i class="bx bx-loader-alt bx-spin"></i> Cargando...
            </div>
            <div v-else-if="!(byWindow.get(w.id)?.length)" class="sdp__cases-empty">
              No recibió casos en esta ventana
            </div>
            <button
              v-for="a in byWindow.get(w.id) ?? []"
              :key="a.id"
              class="sdp__case"
              @click="emit('open-case', a.caseId)"
            >
              <span class="sdp__case-id">#{{ a.caseId?.slice(0, 6).toUpperCase() }}</span>
              <span class="sdp__case-reason">{{ a.reasonLabel }}</span>
              <span class="sdp__case-time">{{ fmtDateTime(a.assignedAt) }}</span>
              <span v-if="!a.isActive" class="sdp__case-out" title="Ya no está asignado a este especialista">
                <i class="bx bx-log-out-circle"></i>
              </span>
              <i class="bx bx-chevron-right sdp__case-go"></i>
            </button>
          </div>
        </div>

        <!-- Load older pages -->
        <button v-if="hasOlderWindows" class="sdp__load-more" :disabled="loadingWindows" @click="loadOlderWindows">
          <i class="bx" :class="loadingWindows ? 'bx-loader-alt bx-spin' : 'bx-history'"></i>
          Cargar más antiguas
        </button>
        <div v-else class="sdp__end">· inicio del periodo ·</div>
      </template>

      <!-- Cargas summary -->
      <div class="sdp__loads">
        <span class="sdp__loads-title">Cargas</span>
        <div class="sdp__loads-grid">
          <div class="sdp__loads-row">
            <span class="sdp__loads-label">Asignaciones activas</span>
            <span class="sdp__loads-val">{{ activeCount }}</span>
          </div>
          <div class="sdp__loads-row">
            <span class="sdp__loads-label">Total histórico</span>
            <span class="sdp__loads-val">{{ totalHistorico ?? '…' }}</span>
          </div>
          <div class="sdp__loads-row">
            <span class="sdp__loads-label">Ventanas en el periodo</span>
            <span class="sdp__loads-val">{{ windowsTotal }}</span>
          </div>
        </div>
        <span v-if="assignmentsTruncated" class="sdp__loads-note">
          <i class="bx bx-info-circle"></i>
          Conteos por ventana sobre las últimas {{ assignments.length }} asignaciones
        </span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sdp {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main);
  border-left: 1px solid var(--border-light);
  overflow: hidden;
}

/* ── Header ── */
.sdp__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-card);
  flex-shrink: 0;
}

.sdp__avatar {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.75rem;
  color: #fff;
}

.sdp__head-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.sdp__name {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sdp__sub { font-size: 0.66rem; color: var(--text-secondary); font-weight: 600; }

.sdp__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.4rem;
  cursor: pointer;
  transition: all 0.12s;
}
.sdp__close:hover { color: var(--text-primary); background: var(--bg-main); }

/* ── KPIs ── */
.sdp__kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.sdp__kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.7rem 0.4rem;
}
.sdp__kpi + .sdp__kpi { border-left: 1px solid var(--border-light); }
.sdp__kpi-num {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.sdp__kpi-label {
  font-size: 0.6rem;
  color: var(--text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
}

/* ── Periods ── */
.sdp__periods {
  display: flex;
  gap: 0.3rem;
  padding: 0.6rem 0.9rem;
  flex-shrink: 0;
}
.sdp__period-btn {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.sdp__period-btn:hover { color: var(--text-primary); border-color: var(--primary-500); }
.sdp__period-btn--active {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: #fff;
}

/* ── Scroll area ── */
.sdp__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0.9rem 1rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border-light) transparent;
}

.sdp__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 2.5rem 0;
  color: var(--text-secondary);
  font-size: 0.78rem;
}

/* ── Window changelog rows ── */
.sdp__win {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  margin-bottom: 0.5rem;
  overflow: hidden;
  transition: border-color 0.15s;
}
.sdp__win--active { border-color: color-mix(in srgb, var(--primary-500) 45%, var(--border-light)); }
.sdp__win--expanded { border-color: var(--primary-500); }

.sdp__win-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: none;
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background 0.1s;
}
.sdp__win-row:hover { background: color-mix(in srgb, var(--bg-card) 70%, var(--border-light)); }

.sdp__win-rail { display: flex; align-items: center; }
.sdp__win-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--border-light);
  flex-shrink: 0;
}
.sdp__win-dot--active {
  background: var(--primary-500);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-500) 25%, transparent);
}

.sdp__win-main { flex: 1; min-width: 0; }

.sdp__win-top { display: flex; align-items: center; gap: 0.45rem; }
.sdp__win-date {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: capitalize;
}
.sdp__win-live {
  font-size: 0.54rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-500) 16%, transparent);
  color: var(--primary-500);
}

.sdp__win-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.15rem;
}
.sdp__win-time {
  font-size: 0.68rem;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sdp__win-app {
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-main);
  padding: 1px 7px;
  border-radius: 999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

.sdp__win-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  min-width: 38px;
}
.sdp__win-count-num {
  font-size: 1rem;
  font-weight: 800;
  color: var(--primary-500);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sdp__win-count--zero .sdp__win-count-num { color: var(--text-secondary); }
.sdp__win-count-label {
  font-size: 0.56rem;
  color: var(--text-secondary);
  font-weight: 700;
  text-transform: uppercase;
}

.sdp__win-caret { font-size: 1rem; color: var(--text-secondary); flex-shrink: 0; }

/* ── Cases inside a window ── */
.sdp__cases {
  border-top: 1px solid var(--border-light);
  background: var(--bg-main);
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sdp__cases-empty {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
  padding: 0.6rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.sdp__case {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.55rem;
  border: none;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background 0.1s;
}
.sdp__case:hover { background: var(--bg-card); }

.sdp__case-id {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.sdp__case-reason {
  font-size: 0.64rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  padding: 1px 6px;
  border-radius: 999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}
.sdp__case-time {
  font-size: 0.62rem;
  color: var(--text-secondary);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sdp__case-out { color: var(--load-mid, #D97706); font-size: 0.8rem; display: flex; }
.sdp__case-go { font-size: 0.9rem; color: var(--text-secondary); flex-shrink: 0; }
.sdp__case:hover .sdp__case-go { color: var(--primary-500); }

/* ── Load more / end ── */
.sdp__load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.5rem;
  border: 1px dashed var(--border-light);
  border-radius: 10px;
  background: none;
  color: var(--text-secondary);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.sdp__load-more:hover:not(:disabled) { color: var(--primary-500); border-color: var(--primary-500); }
.sdp__load-more:disabled { opacity: 0.6; cursor: default; }

.sdp__end {
  text-align: center;
  font-size: 0.64rem;
  color: var(--text-secondary);
  opacity: 0.6;
  padding: 0.5rem 0;
  letter-spacing: 0.05em;
}

/* ── Cargas summary ── */
.sdp__loads {
  margin-top: 1rem;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.sdp__loads-title {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}
.sdp__loads-grid { display: flex; flex-direction: column; gap: 0.35rem; }
.sdp__loads-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sdp__loads-label { font-size: 0.74rem; color: var(--text-secondary); }
.sdp__loads-val {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.sdp__loads-note {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-style: italic;
}
</style>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useCasesRealtime } from '@/presentation/composables/useCasesRealtime'
import CaseFiltersBar from '@/presentation/components/cases/CaseFiltersBar.vue'
import CaseListTable from '@/presentation/components/cases/CaseListTable.vue'
import CaseLoadsView from '@/presentation/components/cases/CaseLoadsView.vue'
import CaseDetailModal from '@/presentation/components/cases/CaseDetailModal.vue'
import CaseCreateModal from '@/presentation/components/cases/CaseCreateModal.vue'
import CaseSpecialistsView from '@/presentation/components/cases/CaseSpecialistsView.vue'

const store = useCasesStore()
const userStore = useUserStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const autopilotError = ref(null)

// Derived from route — no local state needed
const activeTab = computed(() => {
  if (route.name === 'cases-specialists') return 'especialistas'
  if (route.name?.startsWith('cases-loads')) return 'cargas'
  return 'lista'
})

// ── Resizable detail panel ────────────────────────────
const PANEL_MIN = 320
const PANEL_MAX = 960
const PANEL_DEFAULT = 520
const panelWidth = ref(parseInt(localStorage.getItem('tyflow_detail_panel_w')) || PANEL_DEFAULT)

const listStyle = computed(() => {
  if (!store.showDetailModal) return {}
  return { width: `calc(100% - ${panelWidth.value}px - 5px)`, flexShrink: '0' }
})

function onResizeStart(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = panelWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  const onMove = (ev) => {
    // Dragging handle leftward grows the panel (panel is on the right)
    panelWidth.value = Math.max(PANEL_MIN, Math.min(PANEL_MAX, startW + (startX - ev.clientX)))
  }
  const onUp = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    localStorage.setItem('tyflow_detail_panel_w', String(panelWidth.value))
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Keyboard nav (←/→/Escape) when panel is open
function onKeydown(e) {
  if (!store.showDetailModal) return
  if (e.key === 'Escape') store.closeDetail()
  if (e.key === 'ArrowLeft')  { e.preventDefault(); store.goToPrev() }
  if (e.key === 'ArrowRight') { e.preventDefault(); store.goToNext() }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

// ── Autopilot ────────────────────────────────────────
async function runAutopilot() {
  autopilotError.value = null
  try {
    const apps = userStore.applications
    const filters = {}
    if (apps.length === 1) filters.applicationId = apps[0].id
    await store.triggerAutopilot(filters)
  } catch (e) {
    autopilotError.value = e.message || 'Error lanzando autopilot'
    setTimeout(() => { autopilotError.value = null }, 5000)
  }
}

const tabs = [
  { id: 'lista', label: 'Lista', icon: 'bx-list-ul' },
  { id: 'especialistas', label: 'Especialistas', icon: 'bx-group' },
  { id: 'cargas', label: 'Cargas', icon: 'bx-bar-chart-alt-2' },
]

useCasesRealtime()

// ── Status → filter mapping ───────────────────────────
const STATUS_TO_FILTER = {
  todos: null,
  open: 'open',
  assigned: 'assigned',
  in_progress: 'in_progress',
  resolved: 'resolved',
  closed: 'closed',
}

// ── Routing bridge ────────────────────────────────────

// Detail panel: id param is the source of truth
watch(() => route.params.id, (id) => {
  if (id) store.openDetailById(id)
  else store.closeDetail()
}, { immediate: true })

// Close detail → navigate back to list (keep status param)
watch(() => store.showDetailModal, (open) => {
  if (!open && route.name === 'cases-list-detail') {
    router.replace({ name: 'cases-list', params: { status: route.params.status } })
  }
})

// Prev/Next navigation → replace URL without extra history entry
watch(() => store.selectedCase?.id, (id) => {
  if (store.showDetailModal && id && route.params.id !== id) {
    router.replace({ name: 'cases-list-detail', params: { status: route.params.status ?? 'open', id } })
  }
})

// Status tab navigation (fires only when status param changes after mount)
watch(() => route.params.status, (newStatus, oldStatus) => {
  if (oldStatus === undefined) return  // initial load handled in onMounted
  store.loadCases({ status: STATUS_TO_FILTER[newStatus ?? 'open'] ?? null })
})

function openCase(id) {
  router.push({ name: 'cases-list-detail', params: { status: route.params.status ?? 'open', id } })
}

// ── Init ─────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([userStore.loadSelects(), userStore.loadUsers()])
  // Only load cases when on the lista tab
  if (activeTab.value === 'lista') {
    const routeStatus = route.params.status ?? 'open'
    // Set filters directly + loadCases() (no args) so it always refetches —
    // passing newFilters short-circuits when the key is unchanged, leaving total stale.
    store.filters.status = STATUS_TO_FILTER[routeStatus] ?? 'open'
    if (!authStore.isAdmin && authStore.profile?.specialistId) {
      store.filters.specialistId = authStore.profile.specialistId
    }
    await store.loadCases()

    // Al entrar a "abiertos" sin casos, redirigir a "todos"
    if (routeStatus === 'open' && store.pagination.total === 0) {
      router.replace({ name: 'cases-list', params: { status: 'todos' } })
    }
  }
})
</script>

<template>
  <div class="cv">
    <!-- Tabs + actions -->
    <nav class="cv__tabs">
      <button
        v-for="tab in tabs"
        v-show="tab.id !== 'cargas' || authStore.isAdmin"
        :key="tab.id"
        class="cv__tab"
        :class="{ 'cv__tab--active': activeTab === tab.id }"
        @click="tab.id === 'cargas'
          ? router.push({ name: 'cases-loads' })
          : tab.id === 'especialistas'
            ? router.push({ name: 'cases-specialists' })
            : router.push({ name: 'cases-list', params: { status: route.params.status ?? 'open' } })"
      >
        <i :class="'bx ' + tab.icon + ' cv__tab-icon'"></i>
        {{ tab.label }}
        <span v-if="tab.id === 'lista' && store.caseCount" class="cv__tab-badge">
          {{ store.caseCount }}
        </span>
      </button>

      <div class="cv__tabs-end">
        <template v-if="authStore.isAdmin">
          <div v-if="store.autopilotState.running" class="cv__autopilot-pill">
            <i class="bx bx-loader-alt bx-spin"></i>
            <span v-if="store.autopilotState.total">
              {{ store.autopilotState.processed }}/{{ store.autopilotState.total }}
            </span>
            <span v-else>Autopilot...</span>
          </div>
          <button
            class="cv__autopilot-btn"
            :disabled="store.autopilotState.running"
            :title="store.autopilotState.running ? 'Autopilot en progreso' : 'Lanzar WDD Autopilot'"
            @click="runAutopilot"
          >
            <i class="bx bx-bot"></i>
            <span class="cv__btn-label">Autopilot</span>
          </button>
          <button class="cv__create-btn" @click="store.showCreateModal = true">
            <i class="bx bx-plus"></i>
            <span class="cv__btn-label">Nuevo caso</span>
          </button>
        </template>
      </div>
    </nav>

    <!-- Autopilot error -->
    <Transition name="cv-err">
      <div v-if="autopilotError" class="cv__error-pill">
        <i class="bx bx-error-circle"></i> {{ autopilotError }}
      </div>
    </Transition>

    <!-- Lista tab: list + resizable detail panel -->
    <div v-show="activeTab === 'lista'" class="cv__split">
      <!-- Left: filters + table -->
      <div class="cv__list-pane" :style="listStyle">
        <CaseFiltersBar />
        <CaseListTable @select="openCase" />
      </div>

      <!-- Resize handle (only when panel open, desktop only) -->
      <div
        v-if="store.showDetailModal"
        class="cv__resize-handle"
        @mousedown="onResizeStart"
        title="Arrastrar para redimensionar"
      ></div>

      <!-- Right: detail panel -->
      <CaseDetailModal
        v-if="store.showDetailModal"
        class="cv__detail-pane"
        :style="{ width: panelWidth + 'px' }"
      />
    </div>

    <!-- Especialistas tab -->
    <div v-show="activeTab === 'especialistas'" class="cv__cargas">
      <CaseSpecialistsView />
    </div>

    <!-- Cargas tab (admin only) -->
    <div v-show="activeTab === 'cargas' && authStore.isAdmin" class="cv__cargas">
      <CaseLoadsView />
    </div>

    <!-- Create modal (stays as overlay) -->
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

/* ── Tabs ────────────────────────────────────────────── */
.cv__tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-light);
  padding: 0 1.25rem;
  background: var(--bg-card);
  flex-shrink: 0;
}

.cv__tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 0.4rem;
  margin: 0 0.7rem 0 0.2rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s;
  white-space: nowrap;
}
.cv__tab:hover { color: var(--text-primary); }
.cv__tab--active { color: var(--primary-500); border-bottom-color: var(--primary-500); }
.cv__tab-icon { font-size: 1.1rem; }

.cv__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--primary-500);
  color: white;
  line-height: 1.5;
}
.cv__tab:not(.cv__tab--active) .cv__tab-badge {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.cv__tabs-end {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.cv__autopilot-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.95rem;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.cv__autopilot-btn:hover:not(:disabled) { border-color: var(--primary-500); color: var(--primary-500); }
.cv__autopilot-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.cv__autopilot-btn i { font-size: 1.05rem; }

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

.cv__create-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.05rem;
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(42,199,143,0.3);
  transition: all 0.15s;
  white-space: nowrap;
}
.cv__create-btn:hover { background: var(--primary-600); box-shadow: 0 4px 14px rgba(42,199,143,0.4); transform: translateY(-1px); }
.cv__create-btn:active { transform: translateY(0) scale(0.98); }
.cv__create-btn i { font-size: 1.15rem; }

/* ── Split layout ────────────────────────────────────── */
.cv__split {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.cv__list-pane {
  flex: 1;
  min-width: 260px;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* width set via :style when detail panel is open */
}

/* Resize handle between list and detail panel */
.cv__resize-handle {
  width: 5px;
  flex-shrink: 0;
  background: transparent;
  border-left: 1px solid var(--border-light);
  cursor: col-resize;
  position: relative;
  z-index: 1;
  transition: background 0.15s;
}
.cv__resize-handle:hover,
.cv__resize-handle:active {
  background: rgba(42, 199, 143, 0.35);
}

/* Detail panel */
.cv__detail-pane {
  flex-shrink: 0;
  min-width: 320px;
  max-width: 100%;
  height: 100%;
}

/* Cargas tab */
.cv__cargas {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Error pill */
.cv__error-pill {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  background: var(--error-bg, #fff0f0);
  color: var(--error-text, #c53030);
  font-size: 0.78rem;
  font-weight: 600;
  border-bottom: 1px solid var(--error-border, #fed7d7);
  flex-shrink: 0;
}
.cv__error-pill i { font-size: 0.9rem; }

.cv-err-enter-active, .cv-err-leave-active { transition: all 0.2s ease; }
.cv-err-enter-from, .cv-err-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
.cv-err-enter-to, .cv-err-leave-from { opacity: 1; max-height: 60px; }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 768px) {
  .cv__tabs { overflow-x: auto; }
  .cv__tab { padding: 0.6rem 0.75rem; font-size: 0.78rem; }
  .cv__btn-label { display: none; }
  .cv__create-btn,
  .cv__autopilot-btn { padding: 0.4rem; }

  /* On mobile the detail panel covers the entire screen (fixed, in cdp styles) */
  .cv__resize-handle { display: none; }
  /* List pane goes back to full width on mobile (detail is fixed overlay) */
  .cv__list-pane { width: 100% !important; flex: 1 !important; }
}
</style>

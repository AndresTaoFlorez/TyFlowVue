<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useCasesRealtime } from '@/presentation/composables/useCasesRealtime'
import { useCaseDetailMode } from '@/presentation/composables/useCaseDetailMode'
import TopbarBoard from '@/presentation/components/layout/TopbarBoard.vue'
import SidebarBoard from '@/presentation/components/layout/SidebarBoard.vue'
import CaseListTable from '@/presentation/components/cases/CaseListTable.vue'
import CaseDetailHost from '@/presentation/components/cases/CaseDetailHost.vue'
import CaseCreateModal from '@/presentation/components/cases/CaseCreateModal.vue'
import CaseSpecialistsView from '@/presentation/components/cases/CaseSpecialistsView.vue'

const store = useCasesStore()
const userStore = useUserStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const autopilotError = ref(null)
const { mode: detailMode } = useCaseDetailMode()

// ── Active tab derived from route ─────────────────────
const activeTab = computed(() => {
  const n = route.name ?? ''
  if (n.startsWith('cases-specialist') || n.startsWith('cases-loads')) return 'especialistas'
  return 'lista'
})

// ── Resizable docked detail panel ─────────────────────
const PANEL_MIN = 320
const PANEL_MAX = 960
const PANEL_DEFAULT = 520
const panelWidth = ref(parseInt(localStorage.getItem('tyflow_detail_panel_w')) || PANEL_DEFAULT)

const detailDocked = computed(() =>
  store.showDetailModal && (detailMode.value === 'right' || detailMode.value === 'left')
)

const listStyle = computed(() => {
  if (!detailDocked.value) return {}
  return { width: `calc(100% - ${panelWidth.value}px - 5px)`, flexShrink: '0' }
})

function onResizeStart(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = panelWidth.value
  // En modo derecha, arrastrar a la izquierda agranda el panel; en izquierda, al revés.
  const sign = detailMode.value === 'left' ? 1 : -1
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  const onMove = (ev) => {
    panelWidth.value = Math.max(PANEL_MIN, Math.min(PANEL_MAX, startW + sign * (ev.clientX - startX)))
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

// ── Keyboard nav (←/→/Escape) when panel is open ─────
function onKeydown(e) {
  if (!store.showDetailModal) return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
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

useCasesRealtime()

// ── Search (vive en el topbar board) ─────────────────
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

// ── Routing bridge ────────────────────────────────────

// Detail deep-link: /app/cases/:id
watch(() => route.params.id, (id) => {
  if (route.name !== 'cases-list-detail') return
  if (id) store.openDetailById(id)
}, { immediate: true })

// Close detail → navigate back to the clean list URL
watch(() => store.showDetailModal, (open) => {
  if (!open && route.name === 'cases-list-detail') {
    router.replace({ name: 'cases-list' })
  }
})

// Prev/Next navigation → replace URL without extra history entry
watch(() => store.selectedCase?.id, (id) => {
  if (store.showDetailModal && id && route.name === 'cases-list-detail' && route.params.id !== id) {
    router.replace({ name: 'cases-list-detail', params: { id } })
  }
})

function openCase(id) {
  router.push({ name: 'cases-list-detail', params: { id } })
}

// ── Init ─────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([userStore.loadSelects(), userStore.loadUsers()])
  if (!authStore.isAdmin && authStore.profile?.specialistId) {
    store.filters.specialistId = authStore.profile.specialistId
  }
  // Sin redirects automáticos: la lista respeta los filtros persistidos.
  await store.loadCases()
})
</script>

<template>
  <div class="cv">
    <!-- ══ Sidebar board: navegación contextual del módulo ══ -->
    <SidebarBoard>
      <nav class="cv__nav">
        <span class="cv__nav-title">Casos</span>
        <button
          class="cv__nav-item"
          :class="{ 'cv__nav-item--active': activeTab === 'lista' }"
          @click="router.push({ name: 'cases-list' })"
        >
          <i class="bx bx-list-ul"></i>
          <span>Lista</span>
          <span v-if="store.caseCount" class="cv__nav-badge">{{ store.caseCount }}</span>
        </button>
        <button
          class="cv__nav-item"
          :class="{ 'cv__nav-item--active': activeTab === 'especialistas' && !route.name?.startsWith('cases-loads') }"
          @click="router.push({ name: 'cases-specialists' })"
        >
          <i class="bx bx-group"></i>
          <span>Especialistas</span>
        </button>
        <button
          v-if="authStore.isAdmin"
          class="cv__nav-item cv__nav-item--sub"
          :class="{ 'cv__nav-item--active': route.name?.startsWith('cases-loads') }"
          @click="router.push({ name: 'cases-loads' })"
        >
          <i class="bx bx-columns"></i>
          <span>Modo columnas</span>
        </button>
      </nav>
    </SidebarBoard>

    <!-- ══ Topbar board: búsqueda + estado + acciones ══ -->
    <TopbarBoard>
      <div class="cv__topbar">
        <span class="cv__topbar-title">{{ activeTab === 'lista' ? 'Casos' : 'Especialistas' }}</span>

        <!-- Search (solo en lista) -->
        <div
          v-if="activeTab === 'lista'"
          class="cv__search"
          :class="{ 'cv__search--active': store.searchMode, 'cv__search--error': store.searchError && !store.searchLoading }"
        >
          <i class="bx bx-search cv__search-icon"></i>
          <input
            :value="store.searchQuery"
            class="cv__search-input"
            type="text"
            placeholder="Buscar por ID..."
            maxlength="36"
            @input="onSearchInput($event.target.value)"
            @keydown.enter.prevent="doSearch"
            @keydown.escape="clearSearch"
          />
          <i v-if="store.searchLoading" class="bx bx-loader-alt bx-spin cv__search-spinner"></i>
          <button v-else-if="store.searchQuery" class="cv__search-clear" tabindex="-1" @click="clearSearch">
            <i class="bx bx-x"></i>
          </button>
          <span v-if="store.searchError" class="cv__search-tip">{{ store.searchError }}</span>
        </div>

        <span v-if="activeTab === 'lista' && store.searchMode" class="cv__count cv__count--search">
          {{ store.searchResults.length }} resultado{{ store.searchResults.length !== 1 ? 's' : '' }}
        </span>
        <span v-else-if="activeTab === 'lista' && store.caseCount > 0" class="cv__count">
          {{ store.caseCount }} caso{{ store.caseCount !== 1 ? 's' : '' }}
        </span>

        <div class="cv__topbar-end">
          <div v-if="store.autopilotState.running" class="cv__autopilot-pill">
            <i class="bx bx-loader-alt bx-spin"></i>
            <span v-if="store.autopilotState.total">
              {{ store.autopilotState.processed }}/{{ store.autopilotState.total }}
            </span>
            <span v-else>Autopilot...</span>
          </div>
          <template v-if="authStore.isAdmin">
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
      </div>
    </TopbarBoard>

    <!-- Autopilot error -->
    <Transition name="cv-err">
      <div v-if="autopilotError" class="cv__error-pill">
        <i class="bx bx-error-circle"></i> {{ autopilotError }}
      </div>
    </Transition>

    <!-- ══ Lista: tabla + detalle multi-modo ══ -->
    <div v-show="activeTab === 'lista'" class="cv__split">
      <!-- Panel a la izquierda -->
      <template v-if="detailDocked && detailMode === 'left'">
        <CaseDetailHost class="cv__detail-pane" :style="{ width: panelWidth + 'px' }" />
        <div class="cv__resize-handle" @mousedown="onResizeStart" title="Arrastrar para redimensionar"></div>
      </template>

      <!-- Lista -->
      <div class="cv__list-pane" :style="listStyle">
        <CaseListTable @select="openCase" />
      </div>

      <!-- Panel a la derecha -->
      <template v-if="detailDocked && detailMode === 'right'">
        <div class="cv__resize-handle" @mousedown="onResizeStart" title="Arrastrar para redimensionar"></div>
        <CaseDetailHost class="cv__detail-pane" :style="{ width: panelWidth + 'px' }" />
      </template>

      <!-- Flotante / página completa dentro del área de lista -->
      <CaseDetailHost v-if="activeTab === 'lista' && store.showDetailModal && !detailDocked" />
    </div>

    <!-- ══ Especialistas (dashboard + columnas fusionados) ══ -->
    <div v-show="activeTab === 'especialistas'" class="cv__especialistas">
      <CaseSpecialistsView v-if="activeTab === 'especialistas'" />
      <!-- Detalle abierto desde Especialistas: siempre flotante/full -->
      <CaseDetailHost v-if="activeTab === 'especialistas' && store.showDetailModal" :allow-docked="false" />
    </div>

    <!-- Create modal (overlay) -->
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
  position: relative;
}

/* ── Sidebar board nav (tokens --nav-* theme-aware) ──── */
.cv__nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border-top: 1px solid var(--nav-border);
  margin-top: 0.85rem;
  padding: 0.85rem 0.65rem 1.1rem;
}

.cv__nav-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--nav-text);
  opacity: 0.75;
  padding: 0.15rem;
  margin-bottom: 0.35rem;
}

.cv__nav-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--nav-text);
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: left;
}
.cv__nav-item:hover { background: var(--nav-hover); color: var(--nav-text-strong); }
.cv__nav-item--active { background: var(--nav-hover); color: var(--primary-500); font-weight: 600; }
.cv__nav-item i { font-size: 1.1rem; }

.cv__nav-item--sub {
  margin-left: 1.2rem;
  font-size: 0.78rem;
}
.cv__nav-item--sub i { font-size: 0.95rem; }

.cv__nav-badge {
  margin-left: auto;
  font-size: 0.64rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--primary-500);
  color: white;
  line-height: 1.5;
}

/* ── Topbar board (una fila ~36px, fondo transparente) ── */
.cv__topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.cv__topbar-title {
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.cv__topbar-end {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.cv__search {
  position: relative;
  display: flex;
  align-items: center;
  height: 34px;
  width: 200px;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  background: var(--bg-card);
  transition: border-color 0.15s, width 0.2s;
}
.cv__search:focus-within { border-color: var(--primary-500); width: 250px; }
.cv__search--active { border-color: var(--primary-500); }
.cv__search--error { border-color: var(--error, #e53e3e); }

.cv__search-icon {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0 0.35rem 0 0.6rem;
  flex-shrink: 0;
}

.cv__search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.8rem;
  font-family: inherit;
}
.cv__search-input::placeholder { color: var(--text-secondary); opacity: 0.7; }

.cv__search-spinner {
  font-size: 0.85rem;
  color: var(--primary-500);
  margin-right: 0.5rem;
}

.cv__search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 0.3rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
}
.cv__search-clear:hover { color: var(--text-primary); background: var(--bg-main); }

.cv__search-tip {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  padding: 0.3rem 0.6rem;
  background: var(--error, #e53e3e);
  color: white;
  font-size: 0.68rem;
  font-weight: 600;
  border-radius: 6px;
  white-space: nowrap;
  z-index: 60;
}

.cv__count {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}
.cv__count--search { color: var(--primary-500); }

.cv__autopilot-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  height: 34px;
  padding: 0 0.85rem;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: 9px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
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

.cv__create-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  height: 34px;
  padding: 0 0.95rem;
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: 9px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(42,199,143,0.3);
  transition: all 0.15s;
  white-space: nowrap;
}
.cv__create-btn:hover { background: var(--primary-600); box-shadow: 0 4px 14px rgba(42,199,143,0.4); }
.cv__create-btn:active { transform: scale(0.98); }
.cv__create-btn i { font-size: 1.1rem; }

/* ── Split layout ────────────────────────────────────── */
.cv__split {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}

.cv__list-pane {
  flex: 1;
  min-width: 260px;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

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

.cv__detail-pane {
  flex-shrink: 0;
  min-width: 320px;
  max-width: 100%;
  height: 100%;
}

/* ── Especialistas ── */
.cv__especialistas {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ── Error pill ── */
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
  .cv__btn-label { display: none; }
  .cv__create-btn,
  .cv__autopilot-btn { padding: 0 0.5rem; }
  .cv__search { width: 140px; }
  .cv__search:focus-within { width: 170px; }
  .cv__topbar-title { display: none; }

  /* En móvil el panel de detalle cubre toda la pantalla (fixed, estilos cdp) */
  .cv__resize-handle { display: none; }
  .cv__list-pane { width: 100% !important; flex: 1 !important; }
}
</style>

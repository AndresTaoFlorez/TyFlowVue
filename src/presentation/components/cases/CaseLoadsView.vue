<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { STATUS_LABELS, PRIORITY_LABELS, STATUS_TRANSITIONS } from '@/domain/entities/Case'
import CaseReassignModal from '@/presentation/components/cases/CaseReassignModal.vue'

const userStore = useUserStore()
const store = useCasesStore()
const route = useRoute()
const router = useRouter()
const applications = computed(() => userStore.applications ?? [])

// ── Cargas filters ────────────────────────────────────
const cargasFilters = ref({ status: null, originType: null, applicationId: null })

const CARGAS_ORIGINS = [
  { value: 'outlook', label: 'Outlook' },
  { value: 'judit', label: 'Judit' },
  { value: 'tyflow', label: 'TyFlow' },
]

const filteredCargasCases = computed(() => {
  let cases = store.cargasCases
  if (cargasFilters.value.status) cases = cases.filter(c => c.status === cargasFilters.value.status)
  if (cargasFilters.value.originType) cases = cases.filter(c => c.originType === cargasFilters.value.originType)
  if (cargasFilters.value.applicationId) cases = cases.filter(c => c.applicationId === cargasFilters.value.applicationId)
  return cases
})

// ── Panels state ──────────────────────────────────────
// selectedSpecialistId is derived from the route; selectedSpecialist is computed from bySpecialist
// so it stays live when RT events update counters.
const selectedSpecialistId = computed(() => route.params.specialistId ?? null)
const selectedCase         = ref(null)
const showReassign         = ref(false)
const changingStatus       = ref(false)

// ── Mobile (Outlook-style) ────────────────────────────
const MOBILE_BP = 768
const isMobile = ref(window.innerWidth < MOBILE_BP)
// 0=specialists, 1=cases, 2=detail
const mobilePanel = ref(0)

let _resizeTimer = null
function onResize() {
  clearTimeout(_resizeTimer)
  _resizeTimer = setTimeout(() => {
    isMobile.value = window.innerWidth < MOBILE_BP
    if (!isMobile.value) mobilePanel.value = 0
  }, 80)
}

// ── Panel 1 (left) — collapsible + resizable ──────────
const P1_MIN = 200
const P1_MAX = 380
const P1_DEFAULT = 260
const p1Collapsed = ref(localStorage.getItem('tyflow_cl_p1_collapsed') === 'true')
const p1Width     = ref(parseInt(localStorage.getItem('tyflow_cl_p1_width')) || P1_DEFAULT)

function toggleP1() {
  p1Collapsed.value = !p1Collapsed.value
  localStorage.setItem('tyflow_cl_p1_collapsed', String(p1Collapsed.value))
}

function onP1ResizeStart(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = p1Width.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  const onMove = (ev) => {
    p1Width.value = Math.max(P1_MIN, Math.min(P1_MAX, startW + (ev.clientX - startX)))
  }
  const onUp = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    localStorage.setItem('tyflow_cl_p1_width', String(p1Width.value))
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Panel 2 (center) — collapsible + resizable ────────
const P2_MIN = 240
const P2_MAX = 520
const P2_DEFAULT = 320
const p2Collapsed = ref(localStorage.getItem('tyflow_cl_p2_collapsed') === 'true')
const p2Width     = ref(parseInt(localStorage.getItem('tyflow_cl_p2_width')) || P2_DEFAULT)

function toggleP2() {
  p2Collapsed.value = !p2Collapsed.value
  localStorage.setItem('tyflow_cl_p2_collapsed', String(p2Collapsed.value))
}

function onP2ResizeStart(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = p2Width.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  const onMove = (ev) => {
    p2Width.value = Math.max(P2_MIN, Math.min(P2_MAX, startW + (ev.clientX - startX)))
  }
  const onUp = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    localStorage.setItem('tyflow_cl_p2_width', String(p2Width.value))
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Workload data — derived from store.allWorkloads (reactive) ──────────
const bySpecialist = computed(() => {
  const specs = new Map()
  for (const row of store.allWorkloads) {
    const app = applications.value.find(a => a.id === row.application_id)
    if (!specs.has(row.specialist_id)) {
      specs.set(row.specialist_id, {
        specialist_id: row.specialist_id,
        full_name:    row.full_name,
        totalCases:   0,
        anyAvailable: false,
        apps:         [],
      })
    }
    const s = specs.get(row.specialist_id)
    if (row.is_available) s.anyAvailable = true
    s.apps.push({
      appId:            row.application_id,
      appName:          app?.name ?? row.application_id,
      is_available:     row.is_available,
      window_starts_at: row.window_starts_at,
      window_ends_at:   row.window_ends_at,
    })
  }
  // Contadores reales: asignaciones activas por especialista (no por app —
  // el backend no expone el desglose por aplicación).
  for (const s of specs.values()) {
    s.totalCases = store.activeCounts[s.specialist_id] ?? 0
  }
  return [...specs.values()].sort((a, b) => {
    if (a.anyAvailable !== b.anyAvailable) return a.anyAvailable ? -1 : 1
    return a.totalCases - b.totalCases
  })
})

// selectedSpecialist derived from bySpecialist so RT count updates are reflected automatically
const selectedSpecialist = computed(() =>
  bySpecialist.value.find(s => s.specialist_id === selectedSpecialistId.value) ?? null
)

const stats = computed(() => ({
  total:      bySpecialist.value.length,
  available:  bySpecialist.value.filter(s => s.anyAvailable).length,
  totalCases: bySpecialist.value.reduce((sum, s) => sum + s.totalCases, 0),
}))

// ── Cases — derived from store.cargasCases (reactive) ──────────────────
const STATUS_ORDER  = ['assigned', 'in_progress', 'open', 'resolved', 'closed']
const STATUS_COLORS = {
  open:        'var(--status-open)',
  assigned:    'var(--status-assigned)',
  in_progress: 'var(--status-in-progress)',
  resolved:    'var(--status-resolved)',
  closed:      'var(--status-closed)',
}
const STATUS_BG = {
  open:        'var(--status-open-bg)',
  assigned:    'var(--status-assigned-bg)',
  in_progress: 'var(--status-in-progress-bg)',
  resolved:    'var(--status-resolved-bg)',
  closed:      'var(--status-closed-bg)',
}

const casesByStatus = computed(() => {
  const grouped = {}
  for (const s of STATUS_ORDER) grouped[s] = []
  for (const c of filteredCargasCases.value) {
    if (grouped[c.status]) grouped[c.status].push(c)
    else grouped['open']?.push(c)
  }
  return STATUS_ORDER
    .filter(s => grouped[s]?.length > 0)
    .map(s => ({ status: s, cases: grouped[s] }))
})

const panelStats = computed(() => {
  const active = filteredCargasCases.value.filter(c => c.status === 'assigned' || c.status === 'in_progress').length
  const open   = filteredCargasCases.value.filter(c => c.status === 'open').length
  const closed = filteredCargasCases.value.filter(c => c.status === 'closed' || c.status === 'resolved').length
  return { total: filteredCargasCases.value.length, active, open, closed }
})

// Keep selectedCase in sync when store.cargasCases updates via RT events
watch(() => store.cargasCases, (newCases) => {
  const caseId = route.params.caseId
  if (!selectedCase.value && caseId) {
    const found = newCases.find(c => c.id === caseId)
    if (found) selectedCase.value = found
    return
  }
  if (!selectedCase.value) return
  const refreshed = newCases.find(c => c.id === selectedCase.value.id)
  if (refreshed) selectedCase.value = refreshed
}, { deep: true })

// ── Route → state sync ────────────────────────────────
watch(selectedSpecialistId, async (id, oldId) => {
  if (id === oldId) return
  selectedCase.value = null
  showReassign.value = false
  cargasFilters.value = { status: null, originType: null, applicationId: null }
  if (id) {
    await store.loadCargasCases(id)
  }
}, { immediate: true })

watch(() => route.params.caseId, (caseId) => {
  if (!caseId) { selectedCase.value = null; return }
  const found = store.cargasCases.find(c => c.id === caseId)
  if (found) selectedCase.value = found
}, { immediate: true })

// Sync mobilePanel with route when on mobile
watch(() => route.name, (name) => {
  if (!isMobile.value) return
  if (name === 'cases-loads-case') mobilePanel.value = 2
  else if (name === 'cases-loads-specialist') mobilePanel.value = 1
  else mobilePanel.value = 0
}, { immediate: true })

// ── Select specialist ─────────────────────────────────
function selectSpecialist(s) {
  if (selectedSpecialistId.value === s.specialist_id) return
  router.push({ name: 'cases-loads-specialist', params: { specialistId: s.specialist_id } })
}

function selectCase(c) {
  router.push({ name: 'cases-loads-case', params: { specialistId: selectedSpecialistId.value, caseId: c.id } })
}

// ── Case navigation (← / →) ──────────────────────────
const selectedCaseIdx = computed(() => {
  if (!selectedCase.value) return -1
  return filteredCargasCases.value.findIndex(c => c.id === selectedCase.value.id)
})
const hasPrevCase = computed(() => selectedCaseIdx.value > 0)
const hasNextCase = computed(() => selectedCaseIdx.value !== -1 && selectedCaseIdx.value < filteredCargasCases.value.length - 1)

function goToPrevCase() {
  if (hasPrevCase.value) selectCase(filteredCargasCases.value[selectedCaseIdx.value - 1])
}
function goToNextCase() {
  if (hasNextCase.value) selectCase(filteredCargasCases.value[selectedCaseIdx.value + 1])
}

function onKeydown(e) {
  if (!selectedCase.value || showReassign.value) return
  if (e.key === 'ArrowLeft')  { e.preventDefault(); goToPrevCase() }
  if (e.key === 'ArrowRight') { e.preventDefault(); goToNextCase() }
}

// ── Status options for selected case ──────────────────
const statusOptions = computed(() => {
  const current = selectedCase.value?.status
  if (!current) return []
  return [current, ...(STATUS_TRANSITIONS[current] ?? [])]
})

// ── Change case status ────────────────────────────────
async function changeStatus(newStatus) {
  if (!selectedCase.value) return
  changingStatus.value = true
  try {
    const updated = await store.updateCaseStatus(selectedCase.value.id, newStatus)
    selectedCase.value = updated
  } finally {
    changingStatus.value = false
  }
}

// ── Reassign done ─────────────────────────────────────
async function onReassignDone() {
  showReassign.value = false
  if (selectedSpecialistId.value) {
    await store.loadCargasCases(selectedSpecialistId.value)
  }
}

// ── Helpers ───────────────────────────────────────────
function loadColor(count) {
  if (count <= 3) return 'var(--load-low)'
  if (count <= 7) return 'var(--load-mid)'
  return 'var(--load-high)'
}
function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
function hslColor(name) {
  let h = 0
  for (const ch of (name || '')) h = ch.charCodeAt(0) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 45%, 40%)`
}
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function appName(id) {
  return applications.value.find(a => a.id === id)?.name ?? '—'
}

onMounted(async () => {
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)
  store.loadActiveCounts()
  const appIds = applications.value.map(a => a.id)
  if (appIds.length) {
    await store.loadAllWorkloads(appIds)
  } else {
    // Wait for applications to load, then fetch (watch length: replaceAll
    // puede mutar in-place y la referencia no cambiaría)
    const stop = watch(() => applications.value.length, async (n) => {
      if (n) {
        stop()
        await store.loadAllWorkloads(applications.value.map(a => a.id))
      }
    })
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(_resizeTimer)
})
</script>

<template>
  <div class="cl-shell">

    <!-- ══ THREE-PANEL SPLIT ══════════════════════════════ -->
    <div class="cl-split" v-show="!isMobile">

      <!-- Panel 1: Specialists ──────────────────────────── -->
      <aside
        class="cl-p1"
        :class="{ 'cl-p1--collapsed': p1Collapsed }"
        :style="!p1Collapsed ? { width: p1Width + 'px' } : {}"
      >
        <div class="cl-panel-header">
          <span v-if="!p1Collapsed" class="cl-panel-title">Especialistas</span>
          <div class="cl-panel-header-actions">
            <button v-if="!p1Collapsed" class="cl-panel-btn" @click="store.loadAllWorkloads(applications.map(a => a.id))" :disabled="store.loadingAllWorkloads" title="Actualizar">
              <i class="bx bx-refresh" :class="{ 'cl__spin': store.loadingAllWorkloads }"></i>
            </button>
            <button class="cl-panel-btn cl-panel-btn--ghost" @click="toggleP1" :title="p1Collapsed ? 'Expandir' : 'Colapsar'">
              <i class="bx" :class="p1Collapsed ? 'bx-chevron-right' : 'bx-chevron-left'"></i>
            </button>
          </div>
        </div>

        <!-- Collapsed: avatar dots -->
        <div v-if="p1Collapsed" class="cl-p1-collapsed-list">
          <div
            v-for="s in bySpecialist"
            :key="s.specialist_id"
            class="cl-p1-dot"
            :class="{ 'cl-p1-dot--selected': selectedSpecialist?.specialist_id === s.specialist_id }"
            :title="s.full_name"
            @click="selectSpecialist(s)"
          >
            <div class="cl-avatar cl-avatar--sm" :style="{ background: hslColor(s.full_name) }">
              {{ initials(s.full_name) }}
            </div>
          </div>
        </div>

        <!-- Expanded: full list -->
        <div v-else class="cl-p1-list">
          <!-- Summary -->
          <div v-if="!store.loadingAllWorkloads && bySpecialist.length" class="cl-summary">
            <span class="cl-summary-stat">
              <span class="cl-summary-num">{{ stats.available }}</span>
              <span class="cl-summary-lbl">con turno</span>
            </span>
            <span class="cl-summary-sep"></span>
            <span class="cl-summary-stat">
              <span class="cl-summary-num">{{ stats.totalCases }}</span>
              <span class="cl-summary-lbl">casos</span>
            </span>
          </div>

          <!-- Info -->
          <div class="cl-info">
            <i class="bx bx-info-circle"></i>
            Solo especialistas con Ventanas vigentes.
          </div>

          <!-- Skeleton -->
          <template v-if="store.loadingAllWorkloads">
            <div v-for="i in 5" :key="i" class="cl-spec-row cl-spec-row--skeleton">
              <div class="sk sk--circle"></div>
              <div class="sk sk--lines"><div class="sk sk--line"></div><div class="sk sk--line sk--line-short"></div></div>
            </div>
          </template>

          <!-- Empty -->
          <div v-else-if="!store.loadingAllWorkloads && bySpecialist.length === 0" class="cl-p1-empty">
            <i class="bx bx-user-x"></i>
            <span>Sin datos de carga</span>
          </div>

          <!-- Specialist rows -->
          <div
            v-else
            v-for="s in bySpecialist"
            :key="s.specialist_id"
            class="cl-spec-row"
            :class="{
              'cl-spec-row--selected': selectedSpecialist?.specialist_id === s.specialist_id,
              'cl-spec-row--available': s.anyAvailable,
            }"
            @click="selectSpecialist(s)"
          >
            <div class="cl-avatar" :style="{ background: hslColor(s.full_name) }">
              {{ initials(s.full_name) }}
            </div>
            <div class="cl-spec-info">
              <span class="cl-spec-name">{{ s.full_name }}</span>
              <div class="cl-spec-meta">
                <span class="cl-spec-badge" :class="s.anyAvailable ? 'cl-spec-badge--on' : 'cl-spec-badge--off'">
                  <i class="bx bxs-circle"></i>
                  {{ s.anyAvailable ? 'Con turno' : 'Sin turno' }}
                </span>
                <span class="cl-spec-count" :style="{ color: loadColor(s.totalCases) }">
                  {{ s.totalCases }} caso{{ s.totalCases !== 1 ? 's' : '' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Resize handle 1→2 -->
      <div
        v-if="!p1Collapsed"
        class="cl-resize-handle"
        @mousedown="onP1ResizeStart"
      ></div>

      <!-- Panel 2: Cases ────────────────────────────────── -->
      <div
        class="cl-p2"
        :class="{ 'cl-p2--collapsed': p2Collapsed }"
        :style="!p2Collapsed ? { width: p2Width + 'px' } : {}"
      >
        <div class="cl-panel-header">
          <span v-if="!p2Collapsed" class="cl-panel-title">
            {{ selectedSpecialist ? selectedSpecialist.full_name : 'Casos' }}
          </span>
          <button class="cl-panel-btn cl-panel-btn--ghost" @click="toggleP2" :title="p2Collapsed ? 'Expandir' : 'Colapsar'">
            <i class="bx" :class="p2Collapsed ? 'bx-chevron-right' : 'bx-chevron-left'"></i>
          </button>
        </div>

        <template v-if="!p2Collapsed">
          <!-- No specialist selected -->
          <div v-if="!selectedSpecialist" class="cl-p2-placeholder">
            <i class="bx bx-user"></i>
            <span>Selecciona un especialista</span>
          </div>

          <!-- Loading cases -->
          <div v-else-if="store.loadingCargasCases" class="cl-p2-placeholder">
            <i class="bx bx-loader-alt bx-spin"></i>
            <span>Cargando casos...</span>
          </div>

          <!-- Empty cases -->
          <div v-else-if="store.cargasCases.length === 0" class="cl-p2-placeholder">
            <i class="bx bx-folder-open"></i>
            <span>Sin casos registrados</span>
          </div>

          <!-- Has cases: filter bar + list -->
          <template v-else>
            <div class="clf-bar">
              <div class="clf-chips">
                <button class="clf-chip" :class="{ 'clf-chip--active': !cargasFilters.status }" @click="cargasFilters.status = null">Todos</button>
                <button
                  v-for="s in STATUS_ORDER"
                  :key="s"
                  class="clf-chip"
                  :class="{ 'clf-chip--active': cargasFilters.status === s }"
                  :style="cargasFilters.status === s ? { background: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] } : {}"
                  @click="cargasFilters.status = cargasFilters.status === s ? null : s"
                >{{ STATUS_LABELS[s] }}</button>
              </div>
              <div class="clf-selects">
                <select class="clf-select" :value="cargasFilters.originType" @change="cargasFilters.originType = $event.target.value || null">
                  <option value="">Origen</option>
                  <option v-for="o in CARGAS_ORIGINS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <select class="clf-select" :value="cargasFilters.applicationId" @change="cargasFilters.applicationId = $event.target.value || null">
                  <option value="">Aplicación</option>
                  <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
                </select>
              </div>
            </div>
            <div class="cl-p2-body">
              <div v-if="filteredCargasCases.length === 0" class="cl-p2-placeholder" style="flex:1">
                <i class="bx bx-filter-alt"></i>
                <span>Sin resultados con estos filtros</span>
              </div>
              <template v-else>
                <!-- Stats row -->
                <div class="cl-p2-stats">
                  <span class="cl-pstat">
                    <span class="cl-pstat-num">{{ panelStats.total }}</span>
                    <span class="cl-pstat-lbl">total</span>
                  </span>
                  <span class="cl-pstat-sep"></span>
                  <span class="cl-pstat" style="color: var(--status-in-progress)">
                    <span class="cl-pstat-num">{{ panelStats.active }}</span>
                    <span class="cl-pstat-lbl">activos</span>
                  </span>
                  <span class="cl-pstat-sep"></span>
                  <span class="cl-pstat" style="color: var(--status-open)">
                    <span class="cl-pstat-num">{{ panelStats.open }}</span>
                    <span class="cl-pstat-lbl">abiertos</span>
                  </span>
                  <span class="cl-pstat-sep"></span>
                  <span class="cl-pstat">
                    <span class="cl-pstat-num">{{ panelStats.closed }}</span>
                    <span class="cl-pstat-lbl">cerrados</span>
                  </span>
                </div>

                <!-- Status groups -->
                <div v-for="group in casesByStatus" :key="group.status">
                  <div
                    class="cl-case-group-label"
                    :style="{ color: STATUS_COLORS[group.status], background: STATUS_BG[group.status] }"
                  >
                    {{ STATUS_LABELS[group.status] }}
                    <span class="cl-case-group-count">{{ group.cases.length }}</span>
                  </div>
                  <div
                    v-for="c in group.cases"
                    :key="c.id"
                    class="cl-case-row"
                    :class="{ 'cl-case-row--selected': selectedCase?.id === c.id }"
                    @click="selectCase(c)"
                  >
                    <div class="cl-case-row-top">
                      <span class="cl-case-id">{{ c.shortId }}</span>
                      <span class="cl-case-app">{{ appName(c.applicationId) }}</span>
                      <span class="cl-case-date">{{ fmtDate(c.assignedAt || c.createdAt) }}</span>
                    </div>
                    <span class="cl-case-subject">{{ c.subject || '(sin asunto)' }}</span>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </template>

        <!-- Collapsed: icon list -->
        <div v-else class="cl-p2-collapsed-list">
          <div
            v-for="group in casesByStatus"
            :key="group.status"
            class="cl-p2-dot"
            :title="STATUS_LABELS[group.status] + ': ' + group.cases.length"
          >
            <span class="cl-p2-dot-num" :style="{ color: STATUS_COLORS[group.status] }">{{ group.cases.length }}</span>
          </div>
        </div>
      </div>

      <!-- Resize handle 2→3 -->
      <div
        v-if="!p2Collapsed"
        class="cl-resize-handle"
        @mousedown="onP2ResizeStart"
      ></div>

      <!-- Panel 3: Case detail ─────────────────────────── -->
      <main class="cl-p3">
        <!-- No case selected -->
        <div v-if="!selectedCase" class="cl-p3-placeholder">
          <i class="bx bx-file-blank"></i>
          <span>Selecciona un caso para ver el detalle</span>
        </div>

        <!-- Case detail -->
        <div v-else class="cl-p3-body">
          <div class="cl-detail-header">
            <div class="cl-detail-nav">
              <button class="cl-nav-btn" :disabled="!hasPrevCase" title="Anterior (←)" @click="goToPrevCase">
                <i class="bx bx-chevron-left"></i>
              </button>
              <button class="cl-nav-btn" :disabled="!hasNextCase" title="Siguiente (→)" @click="goToNextCase">
                <i class="bx bx-chevron-right"></i>
              </button>
            </div>
            <div class="cl-detail-id">{{ selectedCase.shortId }}</div>
            <div class="cl-detail-badges">
              <span
                class="cl-detail-badge"
                :style="{ color: STATUS_COLORS[selectedCase.status], background: STATUS_BG[selectedCase.status] }"
              >{{ STATUS_LABELS[selectedCase.status] }}</span>
              <span
                v-if="selectedCase.priority"
                class="cl-detail-badge"
                :style="{ color: `var(--priority-${selectedCase.priority})`, background: `var(--priority-${selectedCase.priority}-bg)` }"
              >{{ PRIORITY_LABELS[selectedCase.priority] }}</span>
            </div>
          </div>

          <!-- Action bar -->
          <div class="cl-detail-actions">
            <button
              v-if="selectedCase.isReassignable"
              class="cl-detail-btn"
              @click="showReassign = true"
            >
              <i class="bx bx-transfer"></i> Reasignar
            </button>
            <div class="cl-detail-status-group">
              <span class="cl-detail-status-label">Estado:</span>
              <select
                class="cl-detail-status-select"
                :value="selectedCase.status"
                :disabled="changingStatus"
                @change="changeStatus($event.target.value)"
              >
                <option v-for="s in statusOptions" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
              </select>
            </div>
          </div>

          <h2 class="cl-detail-subject">{{ selectedCase.subject || '(sin asunto)' }}</h2>

          <div v-if="selectedCase.description" class="cl-detail-section">
            <span class="cl-detail-label">Descripción</span>
            <p class="cl-detail-desc">{{ selectedCase.description }}</p>
          </div>

          <div class="cl-detail-grid">
            <div class="cl-detail-field">
              <span class="cl-detail-label">Aplicación</span>
              <span class="cl-detail-value">{{ appName(selectedCase.applicationId) }}</span>
            </div>
            <div class="cl-detail-field">
              <span class="cl-detail-label">Origen</span>
              <span class="cl-detail-value">
                <i class="bx" :class="selectedCase.originIcon"></i>
                {{ selectedCase.originLabel || '—' }}
              </span>
            </div>
            <div class="cl-detail-field">
              <span class="cl-detail-label">Creado</span>
              <span class="cl-detail-value">{{ fmtDate(selectedCase.createdAt) || '—' }}</span>
            </div>
            <div v-if="selectedCase.assignedAt" class="cl-detail-field">
              <span class="cl-detail-label">Asignado</span>
              <span class="cl-detail-value">{{ fmtDate(selectedCase.assignedAt) }}</span>
            </div>
            <div v-if="selectedCase.resolvedAt" class="cl-detail-field">
              <span class="cl-detail-label">Resuelto</span>
              <span class="cl-detail-value">{{ fmtDate(selectedCase.resolvedAt) }}</span>
            </div>
            <div v-if="selectedCase.closedAt" class="cl-detail-field">
              <span class="cl-detail-label">Cerrado</span>
              <span class="cl-detail-value">{{ fmtDate(selectedCase.closedAt) }}</span>
            </div>
            <div v-if="selectedCase.waitingTime" class="cl-detail-field">
              <span class="cl-detail-label">Espera</span>
              <span class="cl-detail-value">{{ selectedCase.waitingTime }}</span>
            </div>
          </div>

          <!-- Historical totals -->
          <div v-if="selectedSpecialist" class="cl-detail-section">
            <span class="cl-detail-label">Totales históricos</span>
            <div class="cl-detail-grid">
              <div class="cl-detail-field">
                <span class="cl-detail-label">Casos asignados (total)</span>
                <span class="cl-detail-value">
                  <template v-if="store.loadingCargasCases">—</template>
                  <template v-else>{{ store.cargasTotalAssignments }}</template>
                </span>
              </div>
              <div class="cl-detail-field">
                <span class="cl-detail-label">Activos ahora</span>
                <span class="cl-detail-value">{{ selectedSpecialist.totalCases }}</span>
              </div>
            </div>
          </div>

          <!-- Specialist apps detail -->
          <div v-if="selectedSpecialist" class="cl-detail-section">
            <span class="cl-detail-label">Cargas del especialista</span>
            <div class="cl-detail-apps">
              <div v-for="app in selectedSpecialist.apps" :key="app.appId" class="cl-detail-app">
                <span class="cl-detail-app-name">{{ app.appName }}</span>
                <div class="cl-detail-app-meta">
                  <span v-if="app.is_available && app.window_starts_at" class="cl-detail-window">
                    <i class="bx bx-time-five"></i>
                    {{ fmtTime(app.window_starts_at) }}–{{ fmtTime(app.window_ends_at) }}
                  </span>
                  <span v-else-if="!app.is_available" class="cl-detail-no-window">sin turno</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div><!-- end cl-split -->

    <!-- Reassign modal (shared desktop+mobile) -->
    <CaseReassignModal
      v-if="showReassign && selectedCase"
      :case-data="selectedCase"
      @close="showReassign = false"
      @done="onReassignDone"
    />

    <!-- ══ MOBILE (Outlook-style, 3 tabs) ════════════════ -->
    <div v-show="isMobile" class="cl-mobile">

      <!-- Panel 0: Specialists -->
      <div v-show="mobilePanel === 0" class="cl-mobile-panel">
        <div class="cl-mob-header">
          <span class="cl-panel-title">Especialistas</span>
          <button class="cl-panel-btn" @click="store.loadAllWorkloads(applications.map(a => a.id))" :disabled="store.loadingAllWorkloads">
            <i class="bx bx-refresh" :class="{ 'cl__spin': store.loadingAllWorkloads }"></i>
          </button>
        </div>
        <div class="cl-info">
          <i class="bx bx-info-circle"></i>
          Solo especialistas con Ventanas vigentes.
        </div>
        <template v-if="store.loadingAllWorkloads">
          <div v-for="i in 4" :key="i" class="cl-spec-row cl-spec-row--skeleton">
            <div class="sk sk--circle"></div>
            <div class="sk sk--lines"><div class="sk sk--line"></div><div class="sk sk--line sk--line-short"></div></div>
          </div>
        </template>
        <div v-else-if="bySpecialist.length === 0" class="cl-p1-empty">
          <i class="bx bx-user-x"></i><span>Sin datos de carga</span>
        </div>
        <div
          v-else
          v-for="s in bySpecialist"
          :key="s.specialist_id"
          class="cl-spec-row"
          :class="{ 'cl-spec-row--available': s.anyAvailable }"
          @click="selectSpecialist(s)"
        >
          <div class="cl-avatar" :style="{ background: hslColor(s.full_name) }">{{ initials(s.full_name) }}</div>
          <div class="cl-spec-info">
            <span class="cl-spec-name">{{ s.full_name }}</span>
            <div class="cl-spec-meta">
              <span class="cl-spec-badge" :class="s.anyAvailable ? 'cl-spec-badge--on' : 'cl-spec-badge--off'">
                <i class="bx bxs-circle"></i>{{ s.anyAvailable ? 'Con turno' : 'Sin turno' }}
              </span>
              <span class="cl-spec-count" :style="{ color: loadColor(s.totalCases) }">
                {{ s.totalCases }} caso{{ s.totalCases !== 1 ? 's' : '' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel 1: Cases -->
      <div v-show="mobilePanel === 1" class="cl-mobile-panel">
        <div class="cl-mob-header">
          <button class="cl-panel-btn" @click="router.push({ name: 'cases-loads' })"><i class="bx bx-arrow-back"></i></button>
          <span class="cl-panel-title">{{ selectedSpecialist?.full_name || 'Casos' }}</span>
        </div>
        <div v-if="store.loadingCargasCases" class="cl-p2-placeholder"><i class="bx bx-loader-alt bx-spin"></i><span>Cargando...</span></div>
        <div v-else-if="!store.cargasCases.length" class="cl-p2-placeholder"><i class="bx bx-folder-open"></i><span>Sin casos</span></div>
        <template v-else>
          <div class="clf-bar">
            <div class="clf-chips">
              <button class="clf-chip" :class="{ 'clf-chip--active': !cargasFilters.status }" @click="cargasFilters.status = null">Todos</button>
              <button
                v-for="s in STATUS_ORDER"
                :key="s"
                class="clf-chip"
                :class="{ 'clf-chip--active': cargasFilters.status === s }"
                :style="cargasFilters.status === s ? { background: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] } : {}"
                @click="cargasFilters.status = cargasFilters.status === s ? null : s"
              >{{ STATUS_LABELS[s] }}</button>
            </div>
            <div class="clf-selects">
              <select class="clf-select" :value="cargasFilters.originType" @change="cargasFilters.originType = $event.target.value || null">
                <option value="">Origen</option>
                <option v-for="o in CARGAS_ORIGINS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <select class="clf-select" :value="cargasFilters.applicationId" @change="cargasFilters.applicationId = $event.target.value || null">
                <option value="">Aplicación</option>
                <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
              </select>
            </div>
          </div>
          <div class="cl-p2-body">
            <div v-if="filteredCargasCases.length === 0" class="cl-p2-placeholder" style="flex:1">
              <i class="bx bx-filter-alt"></i>
              <span>Sin resultados</span>
            </div>
            <template v-else>
              <div class="cl-p2-stats">
                <span class="cl-pstat"><span class="cl-pstat-num">{{ panelStats.total }}</span><span class="cl-pstat-lbl">total</span></span>
                <span class="cl-pstat-sep"></span>
                <span class="cl-pstat"><span class="cl-pstat-num" style="color:var(--status-in-progress)">{{ panelStats.active }}</span><span class="cl-pstat-lbl">activos</span></span>
              </div>
              <div v-for="group in casesByStatus" :key="group.status">
                <div class="cl-case-group-label" :style="{ color: STATUS_COLORS[group.status], background: STATUS_BG[group.status] }">
                  {{ STATUS_LABELS[group.status] }}<span class="cl-case-group-count">{{ group.cases.length }}</span>
                </div>
                <div
                  v-for="c in group.cases"
                  :key="c.id"
                  class="cl-case-row"
                  @click="selectCase(c)"
                >
                  <div class="cl-case-row-top">
                    <span class="cl-case-id">{{ c.shortId }}</span>
                    <span class="cl-case-app">{{ appName(c.applicationId) }}</span>
                    <span class="cl-case-date">{{ fmtDate(c.assignedAt || c.createdAt) }}</span>
                  </div>
                  <span class="cl-case-subject">{{ c.subject || '(sin asunto)' }}</span>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <!-- Panel 2: Case detail -->
      <div v-show="mobilePanel === 2" class="cl-mobile-panel">
        <div class="cl-mob-header">
          <button class="cl-panel-btn" @click="router.push({ name: 'cases-loads-specialist', params: { specialistId: selectedSpecialistId } })"><i class="bx bx-arrow-back"></i></button>
          <span class="cl-panel-title">{{ selectedCase?.shortId || 'Detalle' }}</span>
          <div style="margin-left:auto;display:flex;gap:2px">
            <button class="cl-nav-btn" :disabled="!hasPrevCase" @click="goToPrevCase"><i class="bx bx-chevron-left"></i></button>
            <button class="cl-nav-btn" :disabled="!hasNextCase" @click="goToNextCase"><i class="bx bx-chevron-right"></i></button>
          </div>
        </div>
        <div v-if="!selectedCase" class="cl-p3-placeholder"><i class="bx bx-file-blank"></i><span>Selecciona un caso</span></div>
        <div v-else class="cl-p3-body">
          <div class="cl-detail-header">
            <div class="cl-detail-id">{{ selectedCase.shortId }}</div>
            <div class="cl-detail-badges">
              <span class="cl-detail-badge" :style="{ color: STATUS_COLORS[selectedCase.status], background: STATUS_BG[selectedCase.status] }">{{ STATUS_LABELS[selectedCase.status] }}</span>
              <span v-if="selectedCase.priority" class="cl-detail-badge" :style="{ color: `var(--priority-${selectedCase.priority})`, background: `var(--priority-${selectedCase.priority}-bg)` }">{{ PRIORITY_LABELS[selectedCase.priority] }}</span>
            </div>
          </div>
          <!-- Action bar -->
          <div class="cl-detail-actions">
            <button v-if="selectedCase.isReassignable" class="cl-detail-btn" @click="showReassign = true">
              <i class="bx bx-transfer"></i> Reasignar
            </button>
            <div class="cl-detail-status-group">
              <span class="cl-detail-status-label">Estado:</span>
              <select class="cl-detail-status-select" :value="selectedCase.status" :disabled="changingStatus" @change="changeStatus($event.target.value)">
                <option v-for="s in statusOptions" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
              </select>
            </div>
          </div>
          <h2 class="cl-detail-subject">{{ selectedCase.subject || '(sin asunto)' }}</h2>
          <div v-if="selectedCase.description" class="cl-detail-section">
            <span class="cl-detail-label">Descripción</span>
            <p class="cl-detail-desc">{{ selectedCase.description }}</p>
          </div>
          <div class="cl-detail-grid">
            <div class="cl-detail-field"><span class="cl-detail-label">Aplicación</span><span class="cl-detail-value">{{ appName(selectedCase.applicationId) }}</span></div>
            <div class="cl-detail-field"><span class="cl-detail-label">Creado</span><span class="cl-detail-value">{{ fmtDate(selectedCase.createdAt) || '—' }}</span></div>
            <div v-if="selectedCase.assignedAt" class="cl-detail-field"><span class="cl-detail-label">Asignado</span><span class="cl-detail-value">{{ fmtDate(selectedCase.assignedAt) }}</span></div>
          </div>
        </div>
      </div>
    </div><!-- end cl-mobile -->

    <!-- Mobile bottom tab bar -->
    <nav v-show="isMobile" class="cl-mob-tabs">
      <button class="cl-mob-tab" :class="{ 'cl-mob-tab--active': mobilePanel === 0 }" @click="mobilePanel = 0">
        <i class="bx bx-group"></i><span>Especialistas</span>
      </button>
      <button class="cl-mob-tab" :class="{ 'cl-mob-tab--active': mobilePanel === 1 }" @click="mobilePanel = 1" :disabled="!selectedSpecialist">
        <i class="bx bx-list-ul"></i><span>Casos</span>
      </button>
      <button class="cl-mob-tab" :class="{ 'cl-mob-tab--active': mobilePanel === 2 }" @click="mobilePanel = 2" :disabled="!selectedCase">
        <i class="bx bx-file"></i><span>Detalle</span>
      </button>
    </nav>

  </div><!-- end cl-shell -->
</template>

<style scoped>
/* ── Shell ───────────────────────────────────────────── */
.cl-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-main);
}

/* ── Split (desktop) ─────────────────────────────────── */
.cl-split {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ── Resize handle ───────────────────────────────────── */
.cl-resize-handle {
  width: 6px;
  margin-left: -3px;
  margin-right: -3px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 5;
  background: transparent;
  border-left: 1px solid var(--border-light);
  transition: background 0.15s;
}
.cl-resize-handle:hover,
.cl-resize-handle:active { background: rgba(42, 199, 143, 0.4); }

/* ── Panel 1 ─────────────────────────────────────────── */
.cl-p1 {
  display: flex;
  flex-direction: column;
  background: var(--bg-main);
  overflow: hidden;
  flex-shrink: 0;
  min-width: 200px;
  max-width: 380px;
  border-right: 1px solid var(--border-light);
}

.cl-p1--collapsed {
  width: 52px !important;
  min-width: 52px !important;
  max-width: 52px !important;
}

.cl-p1-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.cl-p1-collapsed-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0;
}

.cl-p1-dot {
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: 2px;
  transition: background 0.1s;
}
.cl-p1-dot:hover { background: var(--bg-card); }
.cl-p1-dot--selected .cl-avatar { outline: 2px solid var(--primary-500); }

.cl-p1-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 2.5rem 1rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
}
.cl-p1-empty i { font-size: 1.8rem; opacity: 0.3; }

/* ── Panel 2 ─────────────────────────────────────────── */
.cl-p2 {
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  overflow: hidden;
  flex-shrink: 0;
  min-width: 240px;
  max-width: 520px;
  border-right: 1px solid var(--border-light);
}

.cl-p2--collapsed {
  width: 52px !important;
  min-width: 52px !important;
  max-width: 52px !important;
}

.cl-p2-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.cl-p2-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
  padding: 2rem;
}
.cl-p2-placeholder i { font-size: 2rem; opacity: 0.28; }

.cl-p2-collapsed-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0;
}

.cl-p2-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 24px;
}

.cl-p2-dot-num {
  font-size: 0.72rem;
  font-weight: 700;
}

/* ── Panel 3 ─────────────────────────────────────────── */
.cl-p3 {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-main);
}

.cl-p3-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  padding: 2rem;
}
.cl-p3-placeholder i { font-size: 2.5rem; opacity: 0.2; }

.cl-p3-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 920px;
}

/* ── Panel header ────────────────────────────────────── */
.cl-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.cl-panel-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cl-panel-header-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.cl-panel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.cl-panel-btn:hover:not(:disabled) { background: var(--bg-card); color: var(--text-primary); }
.cl-panel-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.cl-panel-btn--ghost { }

/* ── Summary bar ─────────────────────────────────────── */
.cl-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-card);
  flex-shrink: 0;
  flex-wrap: wrap;
  font-size: 0.74rem;
}

.cl-summary-stat {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.cl-summary-num {
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--text-primary);
}

.cl-summary-lbl {
  font-size: 0.68rem;
  color: var(--text-secondary);
}

.cl-summary-sep {
  width: 1px;
  height: 0.9rem;
  background: var(--border-light);
  flex-shrink: 0;
}

/* ── Info note ───────────────────────────────────────── */
.cl-info {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.68rem;
  color: var(--text-secondary);
  padding: 0.55rem 1rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.cl-info i { font-size: 0.82rem; color: var(--primary-500); flex-shrink: 0; }

/* ── Skeleton ────────────────────────────────────────── */
.sk {
  background: var(--border-light);
  border-radius: var(--radius-sm);
  animation: sk-pulse 1.5s ease-in-out infinite;
}
.sk--circle { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; }
.sk--lines  { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.sk--line   { height: 0.52rem; }
.sk--line-short { width: 60%; }
@keyframes sk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ── Specialist row ──────────────────────────────────── */
.cl-spec-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  transition: background 0.12s;
  position: relative;
}
.cl-spec-row:hover { background: var(--bg-card); }
.cl-spec-row--selected {
  background: rgba(42, 199, 143, 0.07);
}
.cl-spec-row--selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--primary-500);
}
.cl-spec-row--available { }
.cl-spec-row--skeleton { pointer-events: none; }

/* ── Avatar ──────────────────────────────────────────── */
.cl-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.74rem;
  font-weight: 800;
  flex-shrink: 0;
  letter-spacing: -0.02em;
}
.cl-avatar--sm {
  width: 28px;
  height: 28px;
  font-size: 0.6rem;
}

/* ── Specialist info in row ──────────────────────────── */
.cl-spec-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.cl-spec-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.cl-spec-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.cl-spec-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.cl-spec-badge i { font-size: 0.5rem; vertical-align: 1px; }
.cl-spec-badge--on  { background: color-mix(in srgb, var(--primary-500) 16%, transparent); color: var(--primary-500); }
.cl-spec-badge--off { background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-light); }

.cl-spec-count {
  font-size: 0.68rem;
  font-weight: 700;
}

/* ── Cases in panel 2 ────────────────────────────────── */
.cl-p2-stats {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem 1rem;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  font-size: 0.74rem;
}

.cl-pstat {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}
.cl-pstat-num { font-size: 0.92rem; font-weight: 800; color: var(--text-primary); }
.cl-pstat-lbl { font-size: 0.68rem; color: var(--text-secondary); }
.cl-pstat-sep { width: 1px; height: 0.9rem; background: var(--border-light); flex-shrink: 0; }

.cl-case-group-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.55rem 1rem 0.2rem;
}

.cl-case-group-count {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-card);
  padding: 0 7px;
  border-radius: var(--radius-full);
}

.cl-case-row {
  padding: 0.55rem 1rem;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  transition: background 0.12s;
  position: relative;
}
.cl-case-row:hover { background: var(--bg-card); }
.cl-case-row--selected {
  background: rgba(42,199,143,0.07);
}
.cl-case-row--selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--primary-500);
}

.cl-case-row-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cl-case-id {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.cl-case-app {
  font-size: 0.66rem;
  color: var(--primary-500);
  font-weight: 600;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cl-case-date {
  font-size: 0.66rem;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-left: auto;
}

.cl-case-subject {
  font-size: 0.82rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.2rem;
}

/* ── Case detail actions ─────────────────────────────── */
.cl-detail-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cl-detail-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 36px;
  padding: 0 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.cl-detail-btn i { font-size: 1.05rem; }
.cl-detail-btn:hover { border-color: var(--primary-500); color: var(--primary-500); }

.cl-detail-status-group {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
}

.cl-detail-status-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.cl-detail-status-select {
  height: 36px;
  padding: 0 1.9rem 0 0.7rem;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-card);
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b91a7' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.6rem center;
}
.cl-detail-status-select:focus { border-color: var(--primary-500); }
.cl-detail-status-select:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Case detail (panel 3) ───────────────────────────── */
.cl-detail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cl-detail-nav {
  display: flex;
  gap: 2px;
}

.cl-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.12s;
}
.cl-nav-btn:hover:not(:disabled) { color: var(--text-primary); border-color: var(--primary-500); }
.cl-nav-btn:disabled { opacity: 0.3; cursor: default; }

.cl-detail-id {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.cl-detail-badges {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.cl-detail-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
}

.cl-detail-subject {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.cl-detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cl-detail-label {
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.cl-detail-desc {
  font-size: 0.86rem;
  color: var(--text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
}

.cl-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem 2rem;
}

.cl-detail-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.cl-detail-value {
  font-size: 0.88rem;
  color: var(--text-primary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.cl-detail-apps {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cl-detail-app {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  background: var(--bg-card);
  border-radius: 11px;
  margin-bottom: 0.5rem;
}

.cl-detail-app-name {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.cl-detail-app-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.cl-detail-window {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.62rem;
  color: var(--text-secondary);
}
.cl-detail-window i { font-size: 0.68rem; }

.cl-detail-no-window {
  font-size: 0.62rem;
  color: var(--text-secondary);
  font-style: italic;
  opacity: 0.7;
}

.cl-detail-count {
  font-size: 0.72rem;
  font-weight: 700;
}

/* ── Spin ────────────────────────────────────────────── */
.cl__spin { animation: cl-spin 0.75s linear infinite; }
@keyframes cl-spin { to { transform: rotate(360deg); } }

/* ── Mobile shell ────────────────────────────────────── */
.cl-mobile {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cl-mobile-panel {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.cl-mob-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-main);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}

/* ── Mobile tab bar ──────────────────────────────────── */
.cl-mob-tabs {
  display: flex;
  border-top: 1px solid var(--border-light);
  background: var(--bg-main);
  flex-shrink: 0;
}

.cl-mob-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  gap: 0.18rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.62rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s;
  min-height: 52px;
}
.cl-mob-tab i { font-size: 1.2rem; }
.cl-mob-tab--active { color: var(--primary-500); }
.cl-mob-tab:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Cargas filter bar ───────────────────────────────── */
.clf-bar {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.55rem 1rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-main);
  flex-shrink: 0;
}

.clf-chips {
  display: flex;
  gap: 0.2rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.clf-chips::-webkit-scrollbar { display: none; }

.clf-chip {
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
  flex-shrink: 0;
}
.clf-chip:hover { color: var(--text-primary); border-color: var(--primary-500); }
.clf-chip--active {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}

.clf-selects {
  display: flex;
  gap: 0.3rem;
}

.clf-select {
  flex: 1;
  height: 30px;
  padding: 0 1.5rem 0 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-card);
  cursor: pointer;
  outline: none;
  min-width: 0;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238b91a7' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.4rem center;
}
.clf-select:focus { border-color: var(--primary-500); }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 767px) {
  .cl-split  { display: none; }
  .cl-mobile { display: flex; }
  .cl-mob-tabs { display: flex; }
}
@media (min-width: 768px) {
  .cl-split  { display: flex; }
  .cl-mobile { display: none; }
  .cl-mob-tabs { display: none; }
}
</style>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import CaseStatusTimeline from '@/presentation/components/CaseStatusTimeline.vue'
import CaseAssignPanel from '@/presentation/components/CaseAssignPanel.vue'
import CaseReassignModal from '@/presentation/components/CaseReassignModal.vue'

const store = useCasesStore()
const userStore = useUserStore()

const showAssign = ref(false)
const showReassign = ref(false)

const c = computed(() => store.selectedCase)

const statusOptions = ['open', 'assigned', 'in_progress', 'resolved', 'closed']
const statusLabels = { open: 'Abierto', assigned: 'Asignado', in_progress: 'En progreso', resolved: 'Resuelto', closed: 'Cerrado' }

function onAssignDone() {
  showAssign.value = false
  if (c.value) store.loadCaseById(c.value.id)
}

function onReassignDone() {
  showReassign.value = false
  if (c.value) store.loadCaseById(c.value.id)
}

async function changeStatus(newStatus) {
  await store.updateCaseStatus(c.value.id, newStatus)
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const specialistName = computed(() => {
  if (!c.value?.specialistId) return null
  const s = store.specialistWorkloads.find(w => w.specialist_id === c.value.specialistId)
  return s?.full_name ?? c.value.specialistId.slice(0, 8)
})

const categoryName = computed(() => {
  if (!c.value?.supportCategoryId) return null
  const cat = userStore.supportCategories.find(sc => sc.id === c.value.supportCategoryId)
  return cat?.name ?? c.value.supportCategoryId.slice(0, 8)
})

function onOverlay(e) {
  if (e.target === e.currentTarget) store.closeDetail()
}

const overlay = ref(null)

onMounted(() => {
  nextTick(() => overlay.value?.focus())
})

function onKeydown(e) {
  if (e.key === 'Escape') store.closeDetail()
  if (e.key === 'ArrowLeft') store.goToPrev()
  if (e.key === 'ArrowRight') store.goToNext()
}
</script>

<template>
  <Teleport to="body">
    <div class="cdm__overlay" @click="onOverlay" @keydown="onKeydown" tabindex="-1" ref="overlay">
      <!-- Prev arrow -->
      <button
        v-if="store.hasPrev"
        class="cdm__nav cdm__nav--prev"
        @click.stop="store.goToPrev()"
        aria-label="Caso anterior"
      >
        <i class="bx bx-chevron-left"></i>
      </button>

      <!-- Modal panel -->
      <div class="cdm__panel">
        <!-- Header -->
        <div class="cdm__header">
          <div class="cdm__header-left">
            <span v-if="c" class="cdm__id">{{ c.shortId }}</span>
            <span v-if="store.selectedIndex >= 0" class="cdm__counter">
              {{ store.selectedIndex + 1 }} / {{ store.cases.length }}
            </span>
          </div>
          <button class="cdm__close" @click="store.closeDetail()" aria-label="Cerrar">
            <i class="bx bx-x"></i>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="store.loadingDetail && !c" class="cdm__loading">
          <i class="bx bx-loader-alt bx-spin"></i> Cargando...
        </div>

        <!-- Error -->
        <div v-else-if="store.error && !c" class="cdm__error">
          <i class="bx bx-error-circle"></i> {{ store.error }}
        </div>

        <!-- Content -->
        <div v-else-if="c" class="cdm__body">
          <!-- Title + badges -->
          <h2 class="cdm__title">{{ c.subject }}</h2>
          <div class="cdm__badges">
            <span class="cdm__badge" :style="{ background: c.statusBg, color: c.statusColor }">{{ c.statusLabel }}</span>
            <span class="cdm__badge" :style="{ background: c.priorityBg, color: c.priorityColor }">{{ c.priorityLabel }}</span>
            <span class="cdm__badge" :style="{ background: c.sourceBg, color: c.sourceColor }">
              <i :class="'bx ' + c.sourceIcon" style="font-size: 0.7rem"></i> {{ c.sourceLabel }}
            </span>
          </div>

          <!-- Timeline -->
          <CaseStatusTimeline :case-data="c" />

          <!-- Action bar -->
          <div class="cdm__actions">
            <button v-if="c.isAssignable" class="cdm__action cdm__action--primary" @click="showAssign = !showAssign">
              <i class="bx bx-user-plus"></i> Asignar
            </button>
            <button v-if="c.isReassignable" class="cdm__action" @click="showReassign = true">
              <i class="bx bx-transfer"></i> Reasignar
            </button>
            <div class="cdm__status-group">
              <span class="cdm__status-label">Estado:</span>
              <select class="cdm__status-select" :value="c.status" @change="changeStatus($event.target.value)">
                <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabels[s] }}</option>
              </select>
            </div>
          </div>

          <!-- Assign panel -->
          <CaseAssignPanel v-if="showAssign" :case-id="c.id" @done="onAssignDone" />

          <!-- Details grid -->
          <div class="cdm__section">
            <h4 class="cdm__section-title">Detalles</h4>
            <div class="cdm__grid">
              <div class="cdm__detail">
                <span class="cdm__detail-label">Creado</span>
                <span class="cdm__detail-value">{{ fmtDate(c.createdAt) }}</span>
              </div>
              <div class="cdm__detail">
                <span class="cdm__detail-label">Asignado</span>
                <span class="cdm__detail-value">{{ fmtDate(c.assignedAt) }}</span>
              </div>
              <div class="cdm__detail">
                <span class="cdm__detail-label">Especialista</span>
                <span class="cdm__detail-value">{{ specialistName ?? '—' }}</span>
              </div>
              <div class="cdm__detail">
                <span class="cdm__detail-label">Categoría</span>
                <span class="cdm__detail-value">{{ categoryName ?? '—' }}</span>
              </div>
              <div class="cdm__detail">
                <span class="cdm__detail-label">Resuelto</span>
                <span class="cdm__detail-value">{{ fmtDate(c.resolvedAt) }}</span>
              </div>
            </div>
          </div>

          <div v-if="c.description" class="cdm__section">
            <h4 class="cdm__section-title">Descripción</h4>
            <p class="cdm__description">{{ c.description }}</p>
          </div>
        </div>
      </div>

      <!-- Next arrow -->
      <button
        v-if="store.hasNext"
        class="cdm__nav cdm__nav--next"
        @click.stop="store.goToNext()"
        aria-label="Caso siguiente"
      >
        <i class="bx bx-chevron-right"></i>
      </button>
    </div>

    <!-- Reassign modal on top -->
    <CaseReassignModal
      v-if="showReassign && c"
      :case-data="c"
      @close="showReassign = false"
      @done="onReassignDone"
    />
  </Teleport>
</template>

<style scoped>
.cdm__overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  outline: none;
}

/* Nav arrows */
.cdm__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  font-size: 1.5rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.cdm__nav:hover {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}

/* Panel */
.cdm__panel {
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.cdm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.cdm__header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.cdm__id {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--primary-500);
}
.cdm__counter {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-card);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
}
.cdm__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.12s;
}
.cdm__close:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

/* Loading / Error */
.cdm__loading, .cdm__error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

/* Body */
.cdm__body {
  flex: 1;
  overflow-y: auto;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.cdm__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.cdm__badges {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.cdm__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 700;
}

/* Actions */
.cdm__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cdm__action {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.cdm__action:hover { border-color: var(--primary-500); color: var(--primary-500); }
.cdm__action--primary {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}
.cdm__action--primary:hover { background: var(--primary-600); color: white; }

.cdm__status-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}
.cdm__status-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.cdm__status-select {
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--text-primary);
  background: var(--bg-card);
  cursor: pointer;
  outline: none;
}
.cdm__status-select:focus { border-color: var(--primary-500); }

/* Detail grid */
.cdm__section-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.cdm__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.65rem;
}

.cdm__detail {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.cdm__detail-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cdm__detail-value {
  font-size: 0.82rem;
  color: var(--text-primary);
  font-weight: 500;
}

.cdm__description {
  font-size: 0.82rem;
  color: var(--text-primary);
  line-height: 1.55;
  white-space: pre-wrap;
}

/* Responsive */
@media (max-width: 768px) {
  .cdm__overlay { padding: 0; gap: 0; }
  .cdm__panel {
    max-width: 100%;
    max-height: 100%;
    height: 100%;
    border-radius: 0;
  }
  .cdm__nav {
    position: fixed;
    bottom: 1.25rem;
    z-index: 210;
    width: 44px;
    height: 44px;
  }
  .cdm__nav--prev { left: 1rem; }
  .cdm__nav--next { right: 1rem; }
  .cdm__grid { grid-template-columns: 1fr 1fr; }
}
</style>

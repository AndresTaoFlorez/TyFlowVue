<script setup>
import { computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import CaseStatusTimeline from '@/presentation/components/cases/CaseStatusTimeline.vue'
import CaseAssignPanel from '@/presentation/components/cases/CaseAssignPanel.vue'
import CaseReassignModal from '@/presentation/components/cases/CaseReassignModal.vue'
import { useCaseDetail } from '@/presentation/composables/useCaseDetail'

const store = useCasesStore()
const c = computed(() => store.selectedCase)

const {
  showAssign, toggleAssign, showReassign,
  statusOptions, statusLabels,
  applicationName, supportLevelName, specialistName, categoryName,
  changeStatus, fmtDate,
  onAssignDone, onReassignDone,
} = useCaseDetail(c)

function fmtDateShort(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="cdp">
    <!-- Header -->
    <div class="cdp__header">
      <div class="cdp__header-left">
        <!-- Prev -->
        <button
          class="cdp__nav-btn"
          :disabled="!store.hasPrev"
          @click="store.goToPrev()"
          title="Caso anterior (←)"
        >
          <i class="bx bx-chevron-left"></i>
        </button>
        <!-- Next -->
        <button
          class="cdp__nav-btn"
          :disabled="!store.hasNext || store.loadingMore"
          @click="store.goToNext()"
          title="Caso siguiente (→)"
        >
          <i
            class="bx"
            :class="store.loadingMore && store.selectedIndex >= store.cases.length - 1
              ? 'bx-loader-alt bx-spin'
              : 'bx-chevron-right'"
          ></i>
        </button>
        <span v-if="c" class="cdp__id">{{ c.shortId }}</span>
      </div>
      <button class="cdp__close" @click="store.closeDetail()" aria-label="Cerrar panel">
        <i class="bx bx-x"></i>
      </button>
    </div>

    <!-- Loading skeleton (navigation in-flight) -->
    <div v-if="store.loadingDetail && !c" class="cdp__loading">
      <i class="bx bx-loader-alt bx-spin"></i>
      <span>Cargando...</span>
    </div>

    <!-- Error -->
    <div v-else-if="store.detailError && !c" class="cdp__error">
      <i class="bx bx-error-circle"></i>
      {{ store.detailError }}
    </div>

    <!-- Panel body -->
    <div v-else-if="c" class="cdp__body" :class="{ 'cdp__body--refreshing': store.loadingDetail }">

      <!-- Title + badges -->
      <div class="cdp__hero">
        <h2 class="cdp__title">{{ c.subject || '(sin asunto)' }}</h2>
        <div class="cdp__badges">
          <span class="cdp__badge" :style="{ background: c.statusBg, color: c.statusColor }">
            {{ c.statusLabel }}
          </span>
          <span class="cdp__badge" :style="{ background: c.priorityBg, color: c.priorityColor }">
            {{ c.priorityLabel }}
          </span>
          <span class="cdp__badge" :style="{ background: c.originBg, color: c.originColor }">
            <i :class="'bx ' + c.originIcon" style="font-size:0.7rem"></i>
            {{ c.originLabel }}
          </span>
        </div>
      </div>

      <!-- Timeline -->
      <CaseStatusTimeline :case-data="c" :specialist-name="specialistName" />

      <!-- Action bar -->
      <div class="cdp__actions">
        <button
          v-if="c.isAssignable"
          class="cdp__action"
          :class="{ 'cdp__action--active': showAssign }"
          @click="toggleAssign()"
        >
          <i class="bx bx-user-plus"></i> Asignar
        </button>
        <button v-if="c.isReassignable" class="cdp__action" @click="showReassign = true">
          <i class="bx bx-transfer"></i> Reasignar
        </button>
        <div class="cdp__status-wrap">
          <span class="cdp__status-label">Estado:</span>
          <select class="cdp__status-select" :value="c.status" @change="changeStatus($event.target.value)">
            <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabels[s] }}</option>
          </select>
        </div>
      </div>

      <!-- Assign panel -->
      <CaseAssignPanel v-if="showAssign" :case-id="c.id" @done="onAssignDone" />

      <!-- Meta grid -->
      <div class="cdp__section">
        <span class="cdp__section-title">Información</span>
        <div class="cdp__grid">
          <div v-if="applicationName" class="cdp__field">
            <span class="cdp__label">Aplicación</span>
            <span class="cdp__value">{{ applicationName }}</span>
          </div>
          <div v-if="supportLevelName" class="cdp__field">
            <span class="cdp__label">Nivel de soporte</span>
            <span class="cdp__value">{{ supportLevelName }}</span>
          </div>
          <div v-if="categoryName" class="cdp__field">
            <span class="cdp__label">Categoría</span>
            <span class="cdp__value">{{ categoryName }}</span>
          </div>
          <div v-if="specialistName" class="cdp__field">
            <span class="cdp__label">Especialista</span>
            <span class="cdp__value cdp__value--specialist">
              <i class="bx bx-user-check"></i> {{ specialistName }}
            </span>
          </div>
          <div v-if="c.waitingTime" class="cdp__field">
            <span class="cdp__label">Tiempo en espera</span>
            <span class="cdp__value">{{ c.waitingTime }}</span>
          </div>
        </div>
      </div>

      <!-- Dates grid -->
      <div class="cdp__section">
        <span class="cdp__section-title">Fechas</span>
        <div class="cdp__grid">
          <div class="cdp__field">
            <span class="cdp__label">Creado</span>
            <span class="cdp__value">{{ fmtDateTime(c.createdAt) ?? '—' }}</span>
          </div>
          <div class="cdp__field">
            <span class="cdp__label">Asignado</span>
            <span class="cdp__value">{{ fmtDateTime(c.assignedAt) ?? '—' }}</span>
          </div>
          <div v-if="c.resolvedAt" class="cdp__field">
            <span class="cdp__label">Resuelto</span>
            <span class="cdp__value">{{ fmtDateTime(c.resolvedAt) }}</span>
          </div>
          <div v-if="c.closedAt" class="cdp__field">
            <span class="cdp__label">Cerrado</span>
            <span class="cdp__value">{{ fmtDateTime(c.closedAt) }}</span>
          </div>
          <div v-if="c.updatedAt" class="cdp__field">
            <span class="cdp__label">Actualizado</span>
            <span class="cdp__value">{{ fmtDateTime(c.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="c.description" class="cdp__section">
        <span class="cdp__section-title">Descripción</span>
        <p class="cdp__desc">{{ c.description }}</p>
      </div>

    </div>

    <!-- Reassign modal on top of everything -->
    <CaseReassignModal
      v-if="showReassign && c"
      :case-data="c"
      @close="showReassign = false"
      @done="onReassignDone"
    />
  </div>
</template>

<style scoped>
/* ── Panel shell ─────────────────────────────────────── */
.cdp {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main);
  border-left: 1px solid var(--border-light);
  overflow: hidden;
  position: relative;
}

/* Mobile: slide over full screen */
@media (max-width: 768px) {
  .cdp {
    position: fixed;
    inset: 0;
    z-index: 200;
    border-left: none;
    box-shadow: -4px 0 24px rgba(0,0,0,0.18);
  }
}

/* ── Header ─────────────────────────────────────────── */
.cdp__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  background: var(--bg-card);
}

.cdp__header-left {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.cdp__nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.12s;
}
.cdp__nav-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--primary-500);
}
.cdp__nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.cdp__id {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-left: 0.3rem;
  font-variant-numeric: tabular-nums;
}


.cdp__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.12s;
}
.cdp__close:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

/* ── Loading / Error ─────────────────────────────────── */
.cdp__loading,
.cdp__error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}
.cdp__error { color: var(--error, #e53e3e); }

/* ── Body ────────────────────────────────────────────── */
.cdp__body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Subtle pulse when refreshing detail in background */
.cdp__body--refreshing {
  animation: cdp-refresh-pulse 0.8s ease infinite alternate;
}
@keyframes cdp-refresh-pulse {
  from { opacity: 1; }
  to   { opacity: 0.75; }
}

/* ── Hero ────────────────────────────────────────────── */
.cdp__hero {
  padding: 1.1rem 1.25rem 0.9rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.cdp__title {
  font-size: 1.12rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  margin: 0;
}

.cdp__badges {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.cdp__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

/* ── Actions ─────────────────────────────────────────── */
.cdp__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.6rem 1.1rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-card);
}

.cdp__action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 36px;
  padding: 0 0.8rem;
  border-radius: 9px;
  border: 1px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.cdp__action i { font-size: 1.05rem; }
.cdp__action:hover { border-color: var(--primary-500); color: var(--primary-500); }
.cdp__action--active {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}
.cdp__action--active:hover { background: var(--primary-600); border-color: var(--primary-600); }

.cdp__status-wrap {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
}
.cdp__status-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}
.cdp__status-select {
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
.cdp__status-select:focus { border-color: var(--primary-500); }

/* ── Section ─────────────────────────────────────────── */
.cdp__section {
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.cdp__section-title {
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

/* ── Grid of fields ──────────────────────────────────── */
.cdp__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.2rem;
}

.cdp__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.cdp__label {
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.cdp__value {
  font-size: 0.88rem;
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.cdp__value--specialist {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--primary-600, #1fa672);
  font-weight: 600;
}

/* ── Description ─────────────────────────────────────── */
.cdp__desc {
  font-size: 0.86rem;
  color: var(--text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  margin: 0;
}
</style>

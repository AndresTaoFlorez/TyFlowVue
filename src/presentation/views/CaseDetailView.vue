<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCasesRealtime } from '@/presentation/composables/useCasesRealtime'
import CaseStatusTimeline from '@/presentation/components/CaseStatusTimeline.vue'
import CaseAssignPanel from '@/presentation/components/CaseAssignPanel.vue'
import CaseReassignModal from '@/presentation/components/CaseReassignModal.vue'
import { useCaseDetail } from '@/presentation/composables/useCaseDetail'

const route = useRoute()
const router = useRouter()
const store = useCasesStore()
const userStore = useUserStore()

const c = computed(() => store.selectedCase)

const {
  assignMode, toggleAssign, showReassign,
  statusOptions, statusLabels,
  applicationName, supportLevelName, specialistName, categoryName,
  changeStatus, fmtDate,
} = useCaseDetail(c)

useCasesRealtime()

onMounted(async () => {
  await userStore.loadSelects()
  await store.loadCaseById(route.params.id)
  if (userStore.applications.length > 0) {
    store.loadWorkloads(userStore.applications[0].id)
  }
})

function goBack() {
  router.push({ name: 'casos' })
}

function onAssignDone() {
  assignMode.value = null
  store.loadCaseById(route.params.id)
}

function onReassignDone() {
  showReassign.value = false
  store.loadCaseById(route.params.id)
}
</script>

<template>
  <div class="cd">
    <!-- Loading -->
    <div v-if="store.loadingDetail" class="cd__loading">
      <i class="bx bx-loader-alt bx-spin"></i> Cargando caso...
    </div>

    <!-- Error -->
    <div v-else-if="store.detailError" class="cd__error">
      <i class="bx bx-error-circle"></i> {{ store.detailError }}
      <button class="cd__back-link" @click="goBack">Volver a la lista</button>
    </div>

    <!-- Detail -->
    <template v-else-if="c">
      <!-- Header -->
      <div class="cd__header">
        <button class="cd__back" @click="goBack">
          <i class="bx bx-arrow-back"></i>
        </button>
        <div class="cd__header-info">
          <h2 class="cd__title">{{ c.subject }}</h2>
          <div class="cd__badges">
            <span class="cd__badge" :style="{ background: c.statusBg, color: c.statusColor }">{{ c.statusLabel }}</span>
            <span class="cd__badge" :style="{ background: c.priorityBg, color: c.priorityColor }">{{ c.priorityLabel }}</span>
            <span class="cd__badge" :style="{ background: c.originBg, color: c.originColor }">
              <i :class="'bx ' + c.originIcon" style="font-size: 0.7rem"></i> {{ c.originLabel }}
            </span>
            <span class="cd__id">{{ c.shortId }}</span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <CaseStatusTimeline :case-data="c" />

      <!-- Action bar -->
      <div class="cd__actions">
        <template v-if="c.isAssignable">
          <button class="cd__action" :class="{ 'cd__action--active': assignMode === 'wdd' }" @click="toggleAssign('wdd')">
            <i class="bx bx-bot"></i> WDD Auto
          </button>
          <button class="cd__action" :class="{ 'cd__action--active': assignMode === 'manual' }" @click="toggleAssign('manual')">
            <i class="bx bx-user-plus"></i> Manual
          </button>
        </template>
        <button v-if="c.isReassignable" class="cd__action" @click="showReassign = true">
          <i class="bx bx-transfer"></i> Reasignar
        </button>

        <!-- Status change dropdown -->
        <div class="cd__status-group">
          <span class="cd__status-label">Estado:</span>
          <select class="cd__status-select" :value="c.status" @change="changeStatus($event.target.value)">
            <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabels[s] }}</option>
          </select>
        </div>
      </div>

      <!-- Assign panel inline -->
      <CaseAssignPanel v-if="assignMode" :case-id="c.id" :mode="assignMode" @done="onAssignDone" />

      <!-- Body -->
      <div class="cd__body">
        <div class="cd__section">
          <h4 class="cd__section-title">Detalles</h4>
          <div class="cd__grid">
            <div class="cd__detail">
              <span class="cd__detail-label">Aplicación</span>
              <span class="cd__detail-value">{{ applicationName ?? '—' }}</span>
            </div>
            <div class="cd__detail">
              <span class="cd__detail-label">Nivel</span>
              <span class="cd__detail-value">{{ supportLevelName ?? '—' }}</span>
            </div>
            <div class="cd__detail">
              <span class="cd__detail-label">Categoría</span>
              <span class="cd__detail-value">{{ categoryName ?? '—' }}</span>
            </div>
            <div class="cd__detail">
              <span class="cd__detail-label">Especialista</span>
              <span class="cd__detail-value">{{ specialistName ?? '—' }}</span>
            </div>
            <div class="cd__detail">
              <span class="cd__detail-label">Creado</span>
              <span class="cd__detail-value">{{ fmtDate(c.createdAt) }}</span>
            </div>
            <div class="cd__detail">
              <span class="cd__detail-label">Asignado</span>
              <span class="cd__detail-value">{{ fmtDate(c.assignedAt) }}</span>
            </div>
            <div class="cd__detail">
              <span class="cd__detail-label">Resuelto</span>
              <span class="cd__detail-value">{{ fmtDate(c.resolvedAt) }}</span>
            </div>
          </div>
        </div>

        <div v-if="c.description" class="cd__section">
          <h4 class="cd__section-title">Descripción</h4>
          <p class="cd__description">{{ c.description }}</p>
        </div>
      </div>
    </template>

    <!-- Reassign modal -->
    <CaseReassignModal
      v-if="showReassign && c"
      :case-data="c"
      @close="showReassign = false"
      @done="onReassignDone"
    />
  </div>
</template>

<style scoped>
.cd {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-main);
  padding: 1.25rem;
  gap: 1rem;
}

.cd__loading, .cd__error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex: 1;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.cd__error { flex-direction: column; }

.cd__back-link {
  background: none;
  border: none;
  color: var(--primary-500);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
}

/* Header */
.cd__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.cd__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-primary);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 1rem;
}

.cd__back:hover { border-color: var(--primary-500); color: var(--primary-500); }

.cd__header-info { min-width: 0; }

.cd__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.4rem;
}

.cd__badges {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.cd__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 700;
}

.cd__id {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
}

/* Action bar */
.cd__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cd__action {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}

.cd__action:hover { border-color: var(--primary-500); color: var(--primary-500); }

.cd__action--active {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}

.cd__action--active:hover { background: var(--primary-600); color: white; }

.cd__status-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.cd__status-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.cd__status-select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--text-primary);
  background: var(--bg-main);
  cursor: pointer;
  outline: none;
}

.cd__status-select:focus { border-color: var(--primary-500); }

/* Body */
.cd__body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cd__section-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin-bottom: 0.6rem;
}

.cd__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.cd__detail {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.cd__detail-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cd__detail-value {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
}

.cd__description {
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.55;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .cd { padding: 0.85rem; }
  .cd__title { font-size: 1rem; }
  .cd__grid { grid-template-columns: 1fr 1fr; }
}
</style>

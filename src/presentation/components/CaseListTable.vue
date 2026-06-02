<script setup>
import { useCasesStore } from '@/presentation/stores/useCasesStore'

const store = useCasesStore()

function selectCase(index) {
  store.openDetail(index)
}

function prevPage() {
  if (store.pagination.page > 1) store.loadPage(store.pagination.page - 1)
}

function nextPage() {
  const maxPage = Math.ceil(store.pagination.total / store.pagination.pageSize)
  if (store.pagination.page < maxPage) store.loadPage(store.pagination.page + 1)
}
</script>

<template>
  <div class="ct">
    <!-- Loading -->
    <div v-if="store.loading" class="ct__empty">
      <i class="bx bx-loader-alt bx-spin"></i>
      <span>Cargando casos...</span>
    </div>

    <!-- Empty -->
    <div v-else-if="store.cases.length === 0" class="ct__empty">
      <i class="bx bx-inbox"></i>
      <span>Sin casos para mostrar</span>
    </div>

    <!-- Table -->
    <div v-else class="ct__scroll">
      <table class="ct__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Asunto</th>
            <th>Origen</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, idx) in store.cases" :key="c.id" class="ct__row" @click="selectCase(idx)">
            <td class="ct__id">{{ c.shortId }}</td>
            <td class="ct__subject">{{ c.subject }}</td>
            <td>
              <span class="ct__badge" :style="{ background: c.sourceBg, color: c.sourceColor }">
                <i :class="'bx ' + c.sourceIcon" style="font-size: 0.7rem"></i>
                {{ c.sourceLabel }}
              </span>
            </td>
            <td>
              <span class="ct__badge" :style="{ background: c.priorityBg, color: c.priorityColor }">
                {{ c.priorityLabel }}
              </span>
            </td>
            <td>
              <span class="ct__badge" :style="{ background: c.statusBg, color: c.statusColor }">
                {{ c.statusLabel }}
              </span>
            </td>
            <td class="ct__time">{{ c.waitingTime }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="store.pagination.total > store.pagination.pageSize" class="ct__pag">
      <button class="ct__pag-btn" :disabled="store.pagination.page <= 1" @click="prevPage">
        <i class="bx bx-chevron-left"></i>
      </button>
      <span class="ct__pag-info">
        Página {{ store.pagination.page }} de {{ Math.ceil(store.pagination.total / store.pagination.pageSize) }}
      </span>
      <button class="ct__pag-btn" :disabled="store.pagination.page >= Math.ceil(store.pagination.total / store.pagination.pageSize)" @click="nextPage">
        <i class="bx bx-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ct {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.ct__scroll {
  flex: 1;
  overflow: auto;
}

.ct__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.ct__table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 1;
}

.ct__table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  vertical-align: middle;
}

.ct__row {
  cursor: pointer;
  transition: background 0.1s;
}

.ct__row:hover { background: var(--bg-card); }

.ct__id {
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--primary-500);
  white-space: nowrap;
}

.ct__subject {
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.ct__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.ct__time {
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ct__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.ct__empty i { font-size: 2rem; opacity: 0.35; }

/* Pagination */
.ct__pag {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ct__pag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.12s;
}

.ct__pag-btn:hover:not(:disabled) { border-color: var(--primary-500); color: var(--primary-500); }
.ct__pag-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.ct__pag-info {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .ct__table th:nth-child(6),
  .ct__table td:nth-child(6) { display: none; }
  .ct__subject { max-width: 160px; }
}

@media (max-width: 480px) {
  .ct__table th:nth-child(3),
  .ct__table td:nth-child(3) { display: none; }
}
</style>

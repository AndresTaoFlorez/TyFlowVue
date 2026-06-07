<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

const store = useCasesStore()
const emit = defineEmits(['select'])

const scrollEl = ref(null)
const sentinel = ref(null)
let observer = null

function setupObserver() {
  observer?.disconnect()
  observer = null
  if (!sentinel.value || !scrollEl.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && store.hasMore && !store.loadingMore && !store.loading) {
        store.loadPage(store.pagination.page + 1)
      }
    },
    { root: scrollEl.value, rootMargin: '300px' }
  )
  observer.observe(sentinel.value)
}

watch([sentinel, scrollEl], setupObserver)
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="ct">
    <!-- Skeleton — filter change or first load with empty cache -->
    <div v-if="store.loading" class="ct__scroll">
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
          <tr v-for="i in 12" :key="i" class="ct__row ct__row--skel">
            <td><span class="skel skel--id"></span></td>
            <td><span class="skel" :style="{ width: [72, 55, 80, 60, 90, 48, 75, 63, 85, 52, 70, 65][i - 1] + '%' }"></span></td>
            <td><span class="skel skel--badge"></span></td>
            <td><span class="skel skel--badge" style="width:52px"></span></td>
            <td><span class="skel skel--badge" style="width:68px"></span></td>
            <td><span class="skel skel--time"></span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty state -->
    <div v-else-if="store.cases.length === 0 && !store.listError" class="ct__empty">
      <i class="bx bx-inbox"></i>
      <span>Sin casos para mostrar</span>
    </div>

    <!-- Error state -->
    <div v-else-if="store.listError" class="ct__empty ct__empty--error">
      <i class="bx bx-error-circle"></i>
      <span>{{ store.listError }}</span>
    </div>

    <!-- Table with infinite scroll -->
    <div v-else ref="scrollEl" class="ct__scroll">
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
          <tr
            v-for="c in store.cases"
            :key="c.id"
            class="ct__row"
            tabindex="0"
            role="button"
            :aria-label="c.subject"
            @click="emit('select', c.id)"
            @keydown.enter.prevent="emit('select', c.id)"
            @keydown.space.prevent="emit('select', c.id)"
          >
            <td class="ct__id">{{ c.shortId }}</td>
            <td class="ct__subject">{{ c.subject }}</td>
            <td>
              <span class="ct__badge" :style="{ background: c.originBg, color: c.originColor }">
                <i :class="'bx ' + c.originIcon" style="font-size:0.7rem"></i>
                {{ c.originLabel }}
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

      <!-- Sentinel + load-more indicator -->
      <div ref="sentinel" class="ct__sentinel">
        <div v-if="store.loadingMore" class="ct__load-more">
          <span class="ct__load-more-dot"></span>
          <span class="ct__load-more-dot"></span>
          <span class="ct__load-more-dot"></span>
        </div>
        <div v-else-if="!store.hasMore && store.cases.length > 0" class="ct__end">
          · fin de la lista ·
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ct {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.ct__scroll {
  flex: 1;
  overflow: auto;
}

/* ── Table ── */
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

.ct__row--skel { cursor: default; }
.ct__row--skel:hover { background: transparent; }

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

/* ── Skeleton shimmer ── */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skel {
  display: block;
  height: 11px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--border-light) 25%,
    color-mix(in srgb, var(--bg-card) 80%, var(--border-light)) 50%,
    var(--border-light) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skel--id    { width: 44px; }
.skel--badge { width: 64px; height: 18px; }
.skel--time  { width: 48px; }

/* ── Empty / Error ── */
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
.ct__empty--error i { color: var(--error, #e53e3e); opacity: 0.7; }
.ct__empty--error { color: var(--error, #e53e3e); }

/* ── Sentinel & load-more ── */
.ct__sentinel {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
  min-height: 1px;
}

.ct__load-more {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ct__load-more-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-500);
  opacity: 0.5;
  animation: bounce-dot 1.2s ease-in-out infinite;
}

.ct__load-more-dot:nth-child(1) { animation-delay: 0s; }
.ct__load-more-dot:nth-child(2) { animation-delay: 0.2s; }
.ct__load-more-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce-dot {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
  40%            { transform: scale(1.3); opacity: 1; }
}

.ct__end {
  font-size: 0.68rem;
  color: var(--text-secondary);
  opacity: 0.5;
  letter-spacing: 0.05em;
}

/* ── Responsive ── */
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

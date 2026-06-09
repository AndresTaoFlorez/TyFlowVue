<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { STATUS_LABELS } from '@/domain/entities/Case'

const store = useCasesStore()
const userStore = useUserStore()
const emit = defineEmits(['select'])

// When in search mode, show searchResults; otherwise the normal paginated list.
const displayCases = computed(() => store.searchMode ? store.searchResults : store.cases)

// A result is "out of section" when searching within a specific status filter
// and the found case belongs to a different section.
function isOutOfSection(c) {
  return store.searchMode && store.filters.status && c.status !== store.filters.status
}

// Build specialist id → name lookup from all available sources
const specialistMap = computed(() => {
  const map = new Map()
  for (const u of userStore.users) {
    if (u.specialistId) map.set(u.specialistId, u.fullName)
  }
  for (const w of store.specialistWorkloads) {
    if (w.specialist_id && w.full_name && !map.has(w.specialist_id)) {
      map.set(w.specialist_id, w.full_name)
    }
  }
  for (const w of store.allWorkloads) {
    if (w.specialist_id && w.full_name && !map.has(w.specialist_id)) {
      map.set(w.specialist_id, w.full_name)
    }
  }
  return map
})

function specialistName(id) {
  if (!id) return null
  return specialistMap.value.get(id) ?? null
}

function hslColor(name) {
  let h = 0
  for (const ch of (name || '')) h = ch.charCodeAt(0) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 45%, 40%)`
}

const scrollEl = ref(null)
const sentinel = ref(null)
let observer = null

// Scroll the selected row into view when navigating with arrows
watch(() => store.selectedCase?.id, (id) => {
  if (!id || !scrollEl.value) return
  const row = scrollEl.value.querySelector(`tr[data-case-id="${id}"]`)
  if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

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
            <th class="ct__col-specialist">Especialista</th>
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
            <td class="ct__col-specialist"><span class="skel skel--specialist"></span></td>
            <td><span class="skel skel--time"></span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty state -->
    <div v-else-if="store.searchMode && store.searchResults.length === 0 && !store.searchLoading" class="ct__empty">
      <i class="bx bx-search"></i>
      <span>{{ store.searchError ?? 'Sin resultados' }}</span>
    </div>
    <div v-else-if="!store.searchMode && store.cases.length === 0 && !store.listError" class="ct__empty">
      <i class="bx bx-inbox"></i>
      <span>Sin casos para mostrar</span>
    </div>

    <!-- Error state -->
    <div v-else-if="store.listError && !store.searchMode" class="ct__empty ct__empty--error">
      <i class="bx bx-error-circle"></i>
      <span>{{ store.listError }}</span>
    </div>

    <!-- Table -->
    <div v-else ref="scrollEl" class="ct__scroll">
      <table class="ct__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Asunto</th>
            <th>Origen</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th class="ct__col-specialist">Especialista</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in displayCases"
            :key="c.id"
            :data-case-id="c.id"
            class="ct__row"
            :class="{
              'ct__row--out-of-section': isOutOfSection(c),
              'ct__row--selected': store.selectedCase?.id === c.id,
              'ct__row--urgent': c.priority === 'urgent',
              'ct__row--alta': c.priority === 'high',
            }"
            tabindex="0"
            role="button"
            :aria-label="c.subject"
            @click="emit('select', c.id)"
            @keydown.enter.prevent="emit('select', c.id)"
            @keydown.space.prevent="emit('select', c.id)"
          >
            <td class="ct__id">
              {{ c.shortId }}
              <span v-if="isOutOfSection(c)" class="ct__section-tag" :style="{ background: c.statusBg, color: c.statusColor }">
                {{ STATUS_LABELS[c.status] ?? c.status }}
              </span>
            </td>
            <td class="ct__subject">{{ c.subject }}</td>
            <td>
              <span class="ct__badge" :style="{ background: c.originBg, color: c.originColor }">
                <i :class="'bx ' + c.originIcon" style="font-size:0.7rem"></i>
                {{ c.originLabel }}
              </span>
            </td>
            <td>
              <span class="ct__badge" :style="{ background: c.priorityBg, color: c.priorityColor }">
                <span class="ct__dot" :style="{ background: c.priorityColor }"></span>
                {{ c.priorityLabel }}
              </span>
            </td>
            <td>
              <span class="ct__badge" :style="{ background: c.statusBg, color: c.statusColor }">
                {{ c.statusLabel }}
              </span>
            </td>
            <td class="ct__col-specialist ct__specialist">
              <div v-if="specialistName(c.specialistId)" class="ct__spec-cell">
                <span class="ct__spec-avatar" :style="{ background: hslColor(specialistName(c.specialistId)) }">{{ specialistName(c.specialistId).split(' ').slice(0,2).map(p => p[0]).join('').toUpperCase() }}</span>
                <span class="ct__specialist-name">{{ specialistName(c.specialistId) }}</span>
              </div>
              <span v-else class="ct__specialist-none">Sin asignar</span>
            </td>
            <td class="ct__time">{{ c.waitingTime }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Sentinel + load-more (hidden during search mode) -->
      <div v-if="!store.searchMode" ref="sentinel" class="ct__sentinel">
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
  scrollbar-width: thin;
  scrollbar-color: var(--border-light) transparent;
}
.ct__scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.ct__scroll::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 5px; }

/* ── Table ── */
.ct__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.ct__table th {
  text-align: left;
  padding: 0.7rem 0.9rem;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 4;
  white-space: nowrap;
  user-select: none;
}

.ct__table td {
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  vertical-align: middle;
}

.ct__row {
  cursor: pointer;
  transition: background 0.1s;
}

.ct__row:nth-child(even) { background: var(--bg-card); }
.ct__row:hover { background: color-mix(in srgb, var(--bg-card) 70%, var(--border-light)); }

.ct__row--skel { cursor: default; }
.ct__row--skel:hover { background: transparent; }

/* Priority left border for urgent/high */
.ct__row--urgent {
  box-shadow: inset 3px 0 0 var(--priority-urgent);
}
.ct__row--alta {
  box-shadow: inset 3px 0 0 var(--priority-high);
}

.ct__row--selected {
  background: rgba(42, 199, 143, 0.07) !important;
  box-shadow: inset 3px 0 0 var(--primary-500);
}
.ct__row--selected:hover { background: rgba(42, 199, 143, 0.11) !important; }

.ct__row--out-of-section { opacity: 0.78; }
.ct__row--out-of-section:hover { opacity: 1; background: var(--bg-card); }

.ct__section-tag {
  display: inline-block;
  margin-left: 0.3rem;
  padding: 0.08rem 0.35rem;
  border-radius: var(--radius-sm);
  font-size: 0.6rem;
  font-weight: 700;
  vertical-align: middle;
}

.ct__id {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.ct__subject {
  max-width: 30rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: var(--text-primary);
}

.ct__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.ct__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ct__time {
  font-size: 0.74rem;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.ct__specialist {
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ct__spec-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.ct__spec-avatar {
  width: 26px;
  height: 26px;
  min-width: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.62rem;
  color: #fff;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.ct__specialist-name {
  font-size: 0.74rem;
  color: var(--text-primary);
  font-weight: 500;
}

.ct__specialist-none {
  font-size: 0.74rem;
  color: var(--text-secondary);
  font-style: italic;
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

.skel--id         { width: 44px; }
.skel--badge      { width: 64px; height: 18px; }
.skel--specialist { width: 80px; }
.skel--time       { width: 48px; }

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
@media (max-width: 960px) {
  /* Hide Especialista column when space is tight */
  .ct__col-specialist { display: none; }
}

@media (max-width: 768px) {
  /* Hide Creado (now column 7) */
  .ct__table th:nth-child(7),
  .ct__table td:nth-child(7) { display: none; }
  .ct__subject { max-width: 160px; }
}

@media (max-width: 480px) {
  /* Hide Origen (column 3) */
  .ct__table th:nth-child(3),
  .ct__table td:nth-child(3) { display: none; }
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

const store = useCasesStore()

const search = ref('')
const filterPriority = ref('')

const filteredCases = computed(() => {
  let list = store.pendingCases
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(c =>
      c.subject?.toLowerCase().includes(q) ||
      c.fromAddress?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q)
    )
  }
  if (filterPriority.value) {
    list = list.filter(c => c.priority === filterPriority.value)
  }
  return list
})

const selectedId = computed(() => store.selectedCase?.id)
</script>

<template>
  <div class="cq">
    <div class="cq__header">
      <h3 class="cq__title">Cola de Casos</h3>
      <span class="cq__badge">{{ store.pendingCount }}</span>
    </div>

    <div class="cq__filters">
      <div class="cq__search">
        <i class="bx bx-search"></i>
        <input v-model="search" type="text" placeholder="Buscar..." class="cq__search-input" />
      </div>
      <div class="cq__pills">
        <button class="cq__pill" :class="{ 'cq__pill--active': !filterPriority }" @click="filterPriority = ''">Todas</button>
        <button class="cq__pill cq__pill--p1" :class="{ 'cq__pill--active': filterPriority === 'P1' }" @click="filterPriority = 'P1'">P1</button>
        <button class="cq__pill cq__pill--p2" :class="{ 'cq__pill--active': filterPriority === 'P2' }" @click="filterPriority = 'P2'">P2</button>
        <button class="cq__pill cq__pill--p3" :class="{ 'cq__pill--active': filterPriority === 'P3' }" @click="filterPriority = 'P3'">P3</button>
      </div>
    </div>

    <div v-if="store.loading" class="cq__empty">
      <i class="bx bx-loader-alt bx-spin"></i>
      <span>Cargando casos...</span>
    </div>

    <div v-else-if="filteredCases.length === 0" class="cq__empty">
      <i class="bx bx-inbox"></i>
      <span>Sin casos pendientes</span>
    </div>

    <div v-else class="cq__list">
      <div
        v-for="c in filteredCases"
        :key="c.id"
        class="cc"
        :class="{ 'cc--active': c.id === selectedId }"
        @click="store.selectCase(c)"
      >
        <div class="cc__row">
          <span class="cc__badge" :style="{ background: c.priorityBg, color: c.priorityColor }">
            {{ c.priority }}
          </span>
          <span class="cc__origin" :style="{ background: c.originBg, color: c.originColor }">
            <i :class="'bx ' + c.originIcon" style="font-size:0.7rem"></i>
            {{ c.originLabel }}
          </span>
          <span class="cc__time">{{ c.waitingTime }}</span>
        </div>
        <p class="cc__subject">{{ c.shortSubject }}</p>
        <div class="cc__meta">
          <span v-if="c.fromAddress">{{ c.fromAddress }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cq {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var(--border-light);
}

.cq__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.cq__title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
}

.cq__badge {
  background: var(--priority-p1);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
}

.cq__filters {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex-shrink: 0;
}

.cq__search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.cq__search i { font-size: 0.9rem; flex-shrink: 0; }

.cq__search-input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.78rem;
  color: var(--text-primary);
  background: transparent;
}

.cq__pills {
  display: flex;
  gap: 0.3rem;
}

.cq__pill {
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 700;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s;
}

.cq__pill--active {
  background: var(--text-primary);
  color: white;
  border-color: var(--text-primary);
}

.cq__pill--p1.cq__pill--active { background: var(--priority-p1); border-color: var(--priority-p1); }
.cq__pill--p2.cq__pill--active { background: var(--priority-p2); border-color: var(--priority-p2); }
.cq__pill--p3.cq__pill--active { background: var(--priority-p3); border-color: var(--priority-p3); }

.cq__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem;
}

.cq__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.cq__empty i { font-size: 1.8rem; opacity: 0.35; }

/* Case card */
.cc {
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  margin-bottom: 0.25rem;
}

.cc:hover { background: var(--bg-card); }

.cc--active {
  border-color: var(--primary-500);
  background: rgba(42, 199, 143, 0.04);
}

.cc__row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.3rem;
}

.cc__badge, .cc__origin {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.08rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.cc__time {
  margin-left: auto;
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.cc__subject {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.15rem;
}

.cc__meta {
  font-size: 0.7rem;
  color: var(--text-secondary);
}
</style>

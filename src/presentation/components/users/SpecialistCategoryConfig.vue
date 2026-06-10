<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { AppLevelCategoryRepository } from '@/infrastructure/repositories/AppLevelCategoryRepository'
import { useUserStore } from '@/presentation/stores/useUserStore'

const props = defineProps({
  // [{application_id, support_level_id}] — only complete pairs
  applicationLevels: { type: Array, required: true },
  // Embedded categories from the user's specialist_profile, keyed by `${app}_${level}`:
  //   { [pairKey]: [{ id, name, description, is_assigned }] }
  // Pairs found here are seeded directly (no fetch). Pairs the admin adds anew
  // are fetched from the catalog with every category enabled by default.
  initialCategories: { type: Object, default: () => ({}) },
  // Read-only (e.g. view mode)
  disabled: { type: Boolean, default: false },
})

// Notifies the parent form whether any category flag differs from its initial
// state, so the "Actualizar" button can enable on category-only changes.
const emit = defineEmits(['dirty-change'])

const userStore = useUserStore()

// Single source of truth: pairKey → [{ id, name, description, is_assigned }]
const catsByPair = ref({})
const loadingPair = ref({})
// Snapshot of the seeded is_assigned per pair: pairKey → { catId: is_assigned }
const _initialFlags = {}

function pairKey(appId, levelId) {
  return `${appId}_${levelId}`
}

function snapshotInitial(k) {
  _initialFlags[k] = Object.fromEntries((catsByPair.value[k] ?? []).map(c => [c.id, c.is_assigned]))
}

const isInteractive = computed(() => !props.disabled)

// Seed / fetch categories for each (app, level) pair
watch(() => props.applicationLevels, async (pairs) => {
  const validKeys = new Set(pairs.map(p => pairKey(p.application_id, p.support_level_id)))

  for (const k of Object.keys(catsByPair.value)) {
    if (!validKeys.has(k)) { delete catsByPair.value[k]; delete _initialFlags[k] }
  }

  for (const { application_id, support_level_id } of pairs) {
    const k = pairKey(application_id, support_level_id)
    if (catsByPair.value[k] !== undefined) continue

    const seed = props.initialCategories[k]
    if (seed) {
      // Already in the user's profile — use the embedded flags, no network call.
      catsByPair.value[k] = seed.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        is_assigned: c.is_assigned !== false,
      }))
      snapshotInitial(k)
      continue
    }

    // Newly added pair: fetch the available categories (all enabled by default).
    loadingPair.value[k] = true
    try {
      const pivots = await AppLevelCategoryRepository.fetchAll(application_id, support_level_id)
      const catIds = pivots.map(p => p.support_category_id)
      catsByPair.value[k] = (userStore.supportCategories ?? [])
        .filter(c => catIds.includes(c.id))
        .map(c => ({ id: c.id, name: c.name, description: c.description ?? null, is_assigned: true }))
    } catch {
      catsByPair.value[k] = []
    } finally {
      loadingPair.value[k] = false
      snapshotInitial(k)
    }
  }
}, { immediate: true, deep: true })

// Dirty when any category flag differs from its seeded baseline. A pair with no
// snapshot (just added) baselines to all-enabled, so excluding any is dirty.
const isDirty = computed(() => {
  for (const { application_id, support_level_id } of props.applicationLevels) {
    const k = pairKey(application_id, support_level_id)
    const cats = catsByPair.value[k]
    if (!cats) continue
    const init = _initialFlags[k]
    for (const c of cats) {
      const base = init ? (init[c.id] ?? true) : true
      if (c.is_assigned !== base) return true
    }
  }
  return false
})

watch(isDirty, (v) => emit('dirty-change', v), { immediate: true })

function findCat(pk, catId) {
  return (catsByPair.value[pk] ?? []).find(c => c.id === catId)
}

function toggleCategory(pk, catId) {
  if (!isInteractive.value) return
  const cat = findCat(pk, catId)
  if (cat) cat.is_assigned = !cat.is_assigned
}

function appName(appId) {
  return userStore.applications.find(a => a.id === appId)?.name ?? appId.slice(0, 8)
}

function levelName(levelId) {
  return userStore.supportLevels.find(l => l.id === levelId)?.name ?? levelId.slice(0, 8)
}

// ── Bulk ops + undo ──────────────────────────────────────
const _lastBulkOp = ref(null) // { pk, prev: Map<catId, is_assigned>, timer }

function _saveBulkUndo(pk) {
  if (_lastBulkOp.value?.timer) clearTimeout(_lastBulkOp.value.timer)
  const prev = new Map((catsByPair.value[pk] ?? []).map(c => [c.id, c.is_assigned]))
  const timer = setTimeout(() => { _lastBulkOp.value = null }, 8000)
  _lastBulkOp.value = { pk, prev, timer }
}

function _setAll(pk, value) {
  if (!isInteractive.value) return
  _saveBulkUndo(pk)
  for (const c of catsByPair.value[pk] ?? []) c.is_assigned = value
}

function enableAll(pk) { _setAll(pk, true) }
function excludeAll(pk) { _setAll(pk, false) }

function undoLastBulk() {
  const op = _lastBulkOp.value
  if (!op) return
  clearTimeout(op.timer)
  _lastBulkOp.value = null
  for (const c of catsByPair.value[op.pk] ?? []) {
    if (op.prev.has(c.id)) c.is_assigned = op.prev.get(c.id)
  }
}

function _onKeydown(e) {
  if (_lastBulkOp.value !== null && (e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undoLastBulk()
  }
}

onMounted(() => window.addEventListener('keydown', _onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', _onKeydown)
  if (_lastBulkOp.value?.timer) clearTimeout(_lastBulkOp.value.timer)
})

// Exposed to the parent form: current per-pair category flags, keyed by pairKey.
// The parent folds these into the specialist_profile sent to PATCH/POST /users.
function getCategoryAssignments() {
  const out = {}
  for (const { application_id, support_level_id } of props.applicationLevels) {
    const k = pairKey(application_id, support_level_id)
    out[k] = (catsByPair.value[k] ?? []).map(c => ({ id: c.id, is_assigned: c.is_assigned }))
  }
  return out
}

defineExpose({ getCategoryAssignments })
</script>

<template>
  <div class="scc">
    <div v-if="applicationLevels.length === 0" class="scc__empty">
      Agrega aplicaciones con nivel de soporte para ver las categorías disponibles.
    </div>

    <div v-else class="scc__groups">
      <div
        v-for="pair in applicationLevels"
        :key="pairKey(pair.application_id, pair.support_level_id)"
        class="scc__group"
      >
        <div class="scc__group-header">
          <span class="scc__app-name">{{ appName(pair.application_id) }}</span>
          <span class="scc__sep">·</span>
          <span class="scc__level-name">{{ levelName(pair.support_level_id) }}</span>
          <span v-if="loadingPair[pairKey(pair.application_id, pair.support_level_id)]" class="scc__spinner">
            <i class="bx bx-loader-alt bx-spin"></i>
          </span>
          <template v-else-if="isInteractive && (catsByPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).length > 1">
            <div class="scc__bulk">
              <button
                type="button"
                class="scc__bulk-btn"
                :disabled="(catsByPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).every(c => c.is_assigned)"
                @click.stop="enableAll(pairKey(pair.application_id, pair.support_level_id))"
              >Todos</button>
              <span class="scc__bulk-sep">/</span>
              <button
                type="button"
                class="scc__bulk-btn"
                :disabled="(catsByPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).every(c => !c.is_assigned)"
                @click.stop="excludeAll(pairKey(pair.application_id, pair.support_level_id))"
              >Ninguno</button>
            </div>
          </template>
          <span v-else class="scc__count">
            {{ (catsByPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).length }} categorías
          </span>
        </div>

        <div v-if="!loadingPair[pairKey(pair.application_id, pair.support_level_id)]" class="scc__chips">
          <template v-if="(catsByPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).length > 0">
            <button
              v-for="cat in catsByPair[pairKey(pair.application_id, pair.support_level_id)]"
              :key="cat.id"
              type="button"
              class="scc__chip"
              :class="{
                'scc__chip--excluded': !cat.is_assigned,
                'scc__chip--readonly': !isInteractive,
              }"
              :disabled="!isInteractive"
              :title="isInteractive
                ? (cat.is_assigned ? 'Inhabilitar categoría' : 'Habilitar categoría')
                : cat.name"
              @click="toggleCategory(pairKey(pair.application_id, pair.support_level_id), cat.id)"
            >
              <i v-if="!cat.is_assigned" class="bx bx-x-circle"></i>
              <i v-else class="bx bx-check-circle"></i>
              {{ cat.name }}
            </button>
          </template>
          <span v-else class="scc__no-cats">Sin categorías configuradas para esta combinación.</span>
        </div>

        <transition name="undo-fade">
          <button
            v-if="_lastBulkOp !== null && _lastBulkOp.pk === pairKey(pair.application_id, pair.support_level_id)"
            type="button"
            class="scc__undo-btn"
            @click="undoLastBulk"
          >
            <i class="bx bx-undo"></i> Deshacer
          </button>
        </transition>
      </div>
    </div>

    <p v-if="isInteractive" class="scc__legend">
      <i class="bx bx-info-circle"></i>
      Haz clic en una categoría para habilitarla o inhabilitarla para este especialista.
    </p>
  </div>
</template>

<style scoped>
.scc {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.scc__empty {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-style: italic;
}

.scc__groups {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.scc__group {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.scc__group-header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
}

.scc__app-name {
  font-weight: 700;
  color: var(--text-primary);
}

.scc__sep { color: var(--text-secondary); }

.scc__level-name {
  font-weight: 500;
  color: var(--text-secondary);
}

.scc__spinner {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.scc__count {
  margin-left: auto;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-main);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  padding: 0.1rem 0.4rem;
}

.scc__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.scc__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 500;
  background: rgba(42, 199, 143, 0.1);
  color: var(--primary-600, #1fa672);
  border: 1px solid rgba(42, 199, 143, 0.25);
  cursor: pointer;
  transition: all 0.12s;
}

.scc__chip:not(.scc__chip--readonly):hover {
  background: rgba(42, 199, 143, 0.2);
  border-color: rgba(42, 199, 143, 0.5);
}

/* Excluded (inhabilitada) */
.scc__chip--excluded {
  background: rgba(148, 163, 184, 0.1);
  color: var(--text-secondary);
  border-color: var(--border-light);
  text-decoration: line-through;
  opacity: 0.7;
}

.scc__chip--excluded:not(.scc__chip--readonly):hover {
  background: rgba(148, 163, 184, 0.2);
  border-color: #94a3b8;
  opacity: 1;
}

/* Read-only (view mode) */
.scc__chip--readonly {
  cursor: default;
  pointer-events: none;
}

.scc__no-cats {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-style: italic;
}

.scc__bulk {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.scc__bulk-btn {
  background: none;
  border: none;
  padding: 0.08rem 0.22rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.12s;
}
.scc__bulk-btn:hover:not(:disabled) { color: var(--primary-500); }
.scc__bulk-btn:disabled { opacity: 0.35; cursor: default; }

.scc__bulk-sep {
  font-size: 0.65rem;
  color: var(--border-medium, #ccc);
  user-select: none;
}

.scc__undo-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  background: none;
  border: none;
  padding: 0.12rem 0.3rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.12s;
  align-self: flex-start;
}
.scc__undo-btn:hover { color: var(--primary-500); }
.scc__undo-btn i { font-size: 0.82rem; }

.undo-fade-enter-active, .undo-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.undo-fade-enter-from, .undo-fade-leave-to { opacity: 0; transform: translateY(-3px); }

.scc__legend {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  color: var(--text-secondary);
  font-style: italic;
}
</style>

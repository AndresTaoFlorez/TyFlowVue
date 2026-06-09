<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { AppLevelCategoryRepository } from '@/infrastructure/repositories/AppLevelCategoryRepository'
import { SpecialistCategoryExclusionsRepository } from '@/infrastructure/repositories/SpecialistCategoryExclusionsRepository'
import { useUserStore } from '@/presentation/stores/useUserStore'

const props = defineProps({
  // [{application_id, support_level_id}] — only complete pairs
  applicationLevels: { type: Array, required: true },
  // null in create mode; string specialist_id in edit mode
  specialistId: { type: String, default: null },
  // When true: chip/bulk ops only update local state; call commitPending() to persist
  deferred: { type: Boolean, default: false },
})

const userStore = useUserStore()

// All categories per (app, level) pair
const categoriesPerPair = ref({})
const loadingPair = ref({})

// Exclusions: key = `${app_id}_${cat_id}` → exclusion record { id, ... }
const exclusions = ref({}) // { [appId_catId]: exclusion }
const _savedExclusions = ref({}) // snapshot at load — used by commitPending
const loadingExclusions = ref(false)
const togglingCat = ref(new Set())

function pairKey(appId, levelId) {
  return `${appId}_${levelId}`
}
function exclusionKey(appId, catId) {
  return `${appId}_${catId}`
}

function isExcluded(appId, catId) {
  return exclusionKey(appId, catId) in exclusions.value
}

// Fetch all categories for each pair
watch(() => props.applicationLevels, async (pairs) => {
  const validKeys = new Set(pairs.map(p => pairKey(p.application_id, p.support_level_id)))

  for (const k of Object.keys(categoriesPerPair.value)) {
    if (!validKeys.has(k)) delete categoriesPerPair.value[k]
  }

  for (const { application_id, support_level_id } of pairs) {
    const k = pairKey(application_id, support_level_id)
    if (categoriesPerPair.value[k] !== undefined) continue
    loadingPair.value[k] = true
    try {
      const pivots = await AppLevelCategoryRepository.fetchAll(application_id, support_level_id)
      const catIds = pivots.map(p => p.support_category_id)
      categoriesPerPair.value[k] = (userStore.supportCategories ?? []).filter(c => catIds.includes(c.id))
    } catch {
      categoriesPerPair.value[k] = []
    } finally {
      loadingPair.value[k] = false
    }
  }
}, { immediate: true, deep: true })

// Fetch exclusions whenever specialistId or pairs change
async function refreshExclusions() {
  if (!props.specialistId || props.applicationLevels.length === 0) {
    exclusions.value = {}
    return
  }
  loadingExclusions.value = true
  try {
    const uniqueApps = [...new Set(props.applicationLevels.map(p => p.application_id))]
    const results = await Promise.all(
      uniqueApps.map(appId =>
        SpecialistCategoryExclusionsRepository.fetchAll(props.specialistId, appId)
      )
    )
    const map = {}
    for (const list of results) {
      for (const exc of list) {
        map[exclusionKey(exc.application_id, exc.support_category_id)] = exc
      }
    }
    exclusions.value = map
    _savedExclusions.value = { ...map }
  } catch {
    exclusions.value = {}
    _savedExclusions.value = {}
  } finally {
    loadingExclusions.value = false
  }
}

watch(() => [props.specialistId, props.applicationLevels], refreshExclusions, {
  immediate: true,
  deep: true,
})

async function toggleExclusion(appId, catId) {
  if (!props.specialistId) return
  const key = exclusionKey(appId, catId)

  if (props.deferred) {
    // Local-only flip — no API call, no spinner
    if (isExcluded(appId, catId)) {
      const updated = { ...exclusions.value }
      delete updated[key]
      exclusions.value = updated
    } else {
      exclusions.value = { ...exclusions.value, [key]: { application_id: appId, support_category_id: catId, _deferred: true } }
    }
    return
  }

  if (togglingCat.value.has(key)) return
  togglingCat.value = new Set([...togglingCat.value, key])
  try {
    if (isExcluded(appId, catId)) {
      const exc = exclusions.value[key]
      await SpecialistCategoryExclusionsRepository.remove(exc.id)
      const updated = { ...exclusions.value }
      delete updated[key]
      exclusions.value = updated
    } else {
      const exc = await SpecialistCategoryExclusionsRepository.add(props.specialistId, appId, catId)
      exclusions.value = { ...exclusions.value, [key]: exc }
    }
  } catch {
    // silent — leave state as-is
  } finally {
    const next = new Set(togglingCat.value)
    next.delete(key)
    togglingCat.value = next
  }
}

function appName(appId) {
  return userStore.applications.find(a => a.id === appId)?.name ?? appId.slice(0, 8)
}

function levelName(levelId) {
  return userStore.supportLevels.find(l => l.id === levelId)?.name ?? levelId.slice(0, 8)
}

const isInteractive = computed(() => !!props.specialistId)

// ── Bulk ops + undo ──────────────────────────────────────
const bulkLoading = ref({}) // pairKey → boolean
const _lastBulkOp = ref(null) // { pairKey, appId, cats, prevExcluded: Set, timer }

function _saveBulkUndo(appId, levelId, cats) {
  if (_lastBulkOp.value?.timer) clearTimeout(_lastBulkOp.value.timer)
  const timer = setTimeout(() => { _lastBulkOp.value = null }, 8000)
  _lastBulkOp.value = {
    pk: pairKey(appId, levelId),
    appId,
    cats,
    prevExcluded: new Set(cats.filter(c => isExcluded(appId, c.id)).map(c => c.id)),
    timer,
  }
}

async function enableAll(appId, levelId, cats) {
  if (!props.specialistId) return
  _saveBulkUndo(appId, levelId, cats)
  const pk = pairKey(appId, levelId)
  if (!props.deferred) bulkLoading.value = { ...bulkLoading.value, [pk]: true }
  try {
    await Promise.all(
      cats.filter(c => isExcluded(appId, c.id)).map(c => toggleExclusion(appId, c.id))
    )
  } finally {
    if (!props.deferred) { const b = { ...bulkLoading.value }; delete b[pk]; bulkLoading.value = b }
  }
}

async function excludeAll(appId, levelId, cats) {
  if (!props.specialistId) return
  _saveBulkUndo(appId, levelId, cats)
  const pk = pairKey(appId, levelId)
  if (!props.deferred) bulkLoading.value = { ...bulkLoading.value, [pk]: true }
  try {
    await Promise.all(
      cats.filter(c => !isExcluded(appId, c.id)).map(c => toggleExclusion(appId, c.id))
    )
  } finally {
    if (!props.deferred) { const b = { ...bulkLoading.value }; delete b[pk]; bulkLoading.value = b }
  }
}

async function undoLastBulk() {
  const op = _lastBulkOp.value
  if (!op) return
  clearTimeout(op.timer)
  _lastBulkOp.value = null
  bulkLoading.value = { ...bulkLoading.value, [op.pk]: true }
  try {
    await Promise.all(
      op.cats.map(c => {
        const wasExcluded = op.prevExcluded.has(c.id)
        const isNowExcluded = isExcluded(op.appId, c.id)
        if (wasExcluded !== isNowExcluded) return toggleExclusion(op.appId, c.id)
      }).filter(Boolean)
    )
  } finally {
    const b = { ...bulkLoading.value }; delete b[op.pk]; bulkLoading.value = b
  }
}

function _onKeydown(e) {
  if (_lastBulkOp.value !== null && (e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undoLastBulk()
  }
}

onMounted(()  => window.addEventListener('keydown', _onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', _onKeydown)
  if (_lastBulkOp.value?.timer) clearTimeout(_lastBulkOp.value.timer)
})

// Apply deferred changes to the API. Call this from the parent form on save.
// Resilient: individual failures (e.g. 422 if assignment was removed) are ignored.
async function commitPending() {
  if (!props.specialistId) return
  const ops = []
  for (const [key, exc] of Object.entries(exclusions.value)) {
    if (!(key in _savedExclusions.value)) {
      ops.push(
        SpecialistCategoryExclusionsRepository.add(props.specialistId, exc.application_id, exc.support_category_id).catch(() => {})
      )
    }
  }
  for (const [key, exc] of Object.entries(_savedExclusions.value)) {
    if (!(key in exclusions.value)) {
      ops.push(
        SpecialistCategoryExclusionsRepository.remove(exc.id).catch(() => {})
      )
    }
  }
  await Promise.all(ops)
  _savedExclusions.value = { ...exclusions.value }
}

defineExpose({ commitPending })
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
          <span v-if="loadingPair[pairKey(pair.application_id, pair.support_level_id)] || bulkLoading[pairKey(pair.application_id, pair.support_level_id)]" class="scc__spinner">
            <i class="bx bx-loader-alt bx-spin"></i>
          </span>
          <template v-else-if="isInteractive && (categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).length > 1">
            <div class="scc__bulk">
              <button
                type="button"
                class="scc__bulk-btn"
                :disabled="(categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).every(c => !isExcluded(pair.application_id, c.id))"
                @click.stop="enableAll(pair.application_id, pair.support_level_id, categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)] ?? [])"
              >Todos</button>
              <span class="scc__bulk-sep">/</span>
              <button
                type="button"
                class="scc__bulk-btn"
                :disabled="(categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).every(c => isExcluded(pair.application_id, c.id))"
                @click.stop="excludeAll(pair.application_id, pair.support_level_id, categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)] ?? [])"
              >Ninguno</button>
            </div>
          </template>
          <span v-else class="scc__count">
            {{ (categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).length }} categorías
          </span>
        </div>

        <div v-if="!loadingPair[pairKey(pair.application_id, pair.support_level_id)]" class="scc__chips">
          <template v-if="(categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)] ?? []).length > 0">
            <button
              v-for="cat in categoriesPerPair[pairKey(pair.application_id, pair.support_level_id)]"
              :key="cat.id"
              type="button"
              class="scc__chip"
              :class="{
                'scc__chip--excluded': isExcluded(pair.application_id, cat.id),
                'scc__chip--toggling': togglingCat.has(exclusionKey(pair.application_id, cat.id)),
                'scc__chip--readonly': !isInteractive,
              }"
              :disabled="!isInteractive || togglingCat.has(exclusionKey(pair.application_id, cat.id)) || bulkLoading[pairKey(pair.application_id, pair.support_level_id)]"
              :title="isInteractive
                ? (isExcluded(pair.application_id, cat.id) ? 'Habilitar categoría' : 'Inhabilitar categoría')
                : cat.name"
              @click="toggleExclusion(pair.application_id, cat.id)"
            >
              <i
                v-if="togglingCat.has(exclusionKey(pair.application_id, cat.id))"
                class="bx bx-loader-alt bx-spin"
              ></i>
              <i
                v-else-if="isExcluded(pair.application_id, cat.id)"
                class="bx bx-x-circle"
              ></i>
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

/* Toggling */
.scc__chip--toggling {
  opacity: 0.5;
  cursor: wait;
}

/* Read-only (create mode) */
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

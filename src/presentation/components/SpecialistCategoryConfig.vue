<script setup>
import { ref, watch } from 'vue'
import { AppLevelCategoryRepository } from '@/infrastructure/repositories/AppLevelCategoryRepository'
import { useUserStore } from '@/presentation/stores/useUserStore'

const props = defineProps({
  // [{application_id, support_level_id}] — only complete pairs
  applicationLevels: { type: Array, required: true },
})

const userStore = useUserStore()
const categoriesPerPair = ref({})
const loadingPair = ref({})

function key(appId, levelId) {
  return `${appId}_${levelId}`
}

watch(() => props.applicationLevels, async (pairs) => {
  const validKeys = new Set(pairs.map(p => key(p.application_id, p.support_level_id)))

  for (const k of Object.keys(categoriesPerPair.value)) {
    if (!validKeys.has(k)) delete categoriesPerPair.value[k]
  }

  for (const { application_id, support_level_id } of pairs) {
    const k = key(application_id, support_level_id)
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

function appName(appId) {
  return userStore.applications.find(a => a.id === appId)?.name ?? appId.slice(0, 8)
}

function levelName(levelId) {
  return userStore.supportLevels.find(l => l.id === levelId)?.name ?? levelId.slice(0, 8)
}
</script>

<template>
  <div class="scc">
    <div v-if="applicationLevels.length === 0" class="scc__empty">
      Agrega aplicaciones con nivel de soporte para ver las categorías disponibles.
    </div>

    <div v-else class="scc__groups">
      <div
        v-for="pair in applicationLevels"
        :key="key(pair.application_id, pair.support_level_id)"
        class="scc__group"
      >
        <div class="scc__group-header">
          <span class="scc__app-name">{{ appName(pair.application_id) }}</span>
          <span class="scc__sep">·</span>
          <span class="scc__level-name">{{ levelName(pair.support_level_id) }}</span>
          <span v-if="loadingPair[key(pair.application_id, pair.support_level_id)]" class="scc__spinner">
            <i class="bx bx-loader-alt bx-spin"></i>
          </span>
          <span v-else class="scc__count">
            {{ (categoriesPerPair[key(pair.application_id, pair.support_level_id)] ?? []).length }} categorías
          </span>
        </div>

        <div v-if="!loadingPair[key(pair.application_id, pair.support_level_id)]" class="scc__chips">
          <template v-if="(categoriesPerPair[key(pair.application_id, pair.support_level_id)] ?? []).length > 0">
            <span
              v-for="cat in categoriesPerPair[key(pair.application_id, pair.support_level_id)]"
              :key="cat.id"
              class="scc__chip"
            >{{ cat.name }}</span>
          </template>
          <span v-else class="scc__no-cats">Sin categorías configuradas para esta combinación.</span>
        </div>
      </div>
    </div>
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
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 500;
  background: rgba(42, 199, 143, 0.1);
  color: var(--primary-600, #1fa672);
  border: 1px solid rgba(42, 199, 143, 0.25);
}

.scc__no-cats {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-style: italic;
}
</style>

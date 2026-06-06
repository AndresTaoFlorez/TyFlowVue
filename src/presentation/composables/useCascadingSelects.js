import { ref, watch } from 'vue'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { fetchApplicationSupportLevelsUseCase } from '@/application/use-cases/applications/FetchApplicationSupportLevelsUseCase'
import { fetchAppLevelCategoriesUseCase } from '@/application/use-cases/applications/FetchAppLevelCategoriesUseCase'

// Module-level caches — survive composable unmount, shared across all instances
const _levelsCache = new Map()     // appId → Level[]
const _catsCache   = new Map()     // `${appId}_${levelId}` → Category[]

/**
 * Encapsulates the App → SupportLevel → SupportCategory cascading select pattern.
 *
 * @param {import('vue').Ref<string>} applicationIdRef
 * @param {import('vue').Ref<string>} supportLevelIdRef
 * @param {import('vue').Ref<string>} supportCategoryIdRef
 * @param {{ immediate?: boolean }} [options]
 */
export function useCascadingSelects(applicationIdRef, supportLevelIdRef, supportCategoryIdRef, options = {}) {
  const userStore = useUserStore()

  const availableLevels = ref([])
  const availableCategories = ref([])
  const loadingLevels = ref(false)
  const loadingCategories = ref(false)

  // App changed → load levels, clear downstream
  watch(applicationIdRef, async (appId) => {
    supportLevelIdRef.value = ''
    supportCategoryIdRef.value = ''
    availableCategories.value = []
    availableLevels.value = []
    if (!appId) return

    if (_levelsCache.has(appId)) {
      availableLevels.value = _levelsCache.get(appId)
      return
    }

    loadingLevels.value = true
    try {
      const pivots = await fetchApplicationSupportLevelsUseCase(appId)
      const ids = pivots.map(p => p.support_level_id)
      const levels = (userStore.supportLevels ?? []).filter(l => ids.includes(l.id))
      _levelsCache.set(appId, levels)
      availableLevels.value = levels
    } catch { /* silent */ }
    finally { loadingLevels.value = false }
  }, { immediate: options.immediate ?? false })

  // Level changed → load categories scoped to (app, level)
  watch(supportLevelIdRef, async (levelId) => {
    supportCategoryIdRef.value = ''
    availableCategories.value = []
    const appId = applicationIdRef.value
    if (!levelId || !appId) return

    const cacheKey = `${appId}_${levelId}`
    if (_catsCache.has(cacheKey)) {
      availableCategories.value = _catsCache.get(cacheKey)
      return
    }

    loadingCategories.value = true
    try {
      const pivots = await fetchAppLevelCategoriesUseCase(appId, levelId)
      const ids = pivots.map(p => p.support_category_id)
      const cats = (userStore.supportCategories ?? []).filter(c => ids.includes(c.id))
      _catsCache.set(cacheKey, cats)
      availableCategories.value = cats
    } catch { /* silent */ }
    finally { loadingCategories.value = false }
  })

  return {
    availableLevels,
    availableCategories,
    loadingLevels,
    loadingCategories,
  }
}

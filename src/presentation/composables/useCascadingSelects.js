import { ref, watch } from 'vue'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { fetchApplicationSupportLevelsUseCase } from '@/application/use-cases/applications/FetchApplicationSupportLevelsUseCase'
import { fetchAppLevelCategoriesUseCase } from '@/application/use-cases/applications/FetchAppLevelCategoriesUseCase'

/**
 * Encapsulates the App → SupportLevel → SupportCategory cascading select pattern.
 *
 * @param {import('vue').Ref<string>} applicationIdRef - reactive ref to the selected application ID
 * @param {import('vue').Ref<string>} supportLevelIdRef - reactive ref to the selected support level ID
 * @param {import('vue').Ref<string>} supportCategoryIdRef - reactive ref to the selected support category ID
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
    availableLevels.value = []
    availableCategories.value = []
    if (!appId) return
    loadingLevels.value = true
    try {
      const pivots = await fetchApplicationSupportLevelsUseCase(appId)
      const ids = pivots.map(p => p.support_level_id)
      availableLevels.value = (userStore.supportLevels ?? []).filter(l => ids.includes(l.id))
    } catch { /* silent */ }
    finally { loadingLevels.value = false }
  }, { immediate: options.immediate ?? false })

  // Level changed → load categories scoped to (app, level)
  watch(supportLevelIdRef, async (levelId) => {
    supportCategoryIdRef.value = ''
    availableCategories.value = []
    const appId = applicationIdRef.value
    if (!levelId || !appId) return
    loadingCategories.value = true
    try {
      const pivots = await fetchAppLevelCategoriesUseCase(appId, levelId)
      const ids = pivots.map(p => p.support_category_id)
      availableCategories.value = (userStore.supportCategories ?? []).filter(c => ids.includes(c.id))
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

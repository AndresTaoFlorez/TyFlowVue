import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'
import { SupportCategoryRepository } from '@/infrastructure/repositories/SupportCategoryRepository'
import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'
import { AppSupportLevelCategoryRepository } from '@/infrastructure/repositories/AppSupportLevelCategoryRepository'
import { useUserStore } from '@/presentation/stores/useUserStore'

export const useSettingsStore = defineStore('settings', () => {
  const error = ref(null)

  // Reference data: read from useUserStore (single source of truth)
  const userStore = useUserStore()
  const roles = computed(() => userStore.roles)
  const supportLevels = computed(() => userStore.supportLevels)
  const supportCategories = computed(() => userStore.supportCategories)
  const loading = computed(() => userStore.loadingSelects)

  // ── Hierarchy state ──
  const selectedAppId = ref(null)
  const selectedLevelId = ref(null)
  const appLevelPivots = ref([])       // pivot records for selected app
  const levelCategoryPivots = ref([])  // pivot records for selected level
  const loadingPivots = ref(false)

  // ── CRUD: Support Levels ──
  async function createSupportLevel(payload) {
    error.value = null
    const created = await SupportLevelRepository.create(payload)
    userStore.supportLevels.push(created)
    return created
  }

  async function updateSupportLevel(id, payload) {
    error.value = null
    const updated = await SupportLevelRepository.update(id, payload)
    const idx = userStore.supportLevels.findIndex(sl => sl.id === id)
    if (idx !== -1) userStore.supportLevels[idx] = updated
    return updated
  }

  async function deleteSupportLevel(id) {
    error.value = null
    await SupportLevelRepository.delete(id)
    const idx = userStore.supportLevels.findIndex(sl => sl.id === id)
    if (idx !== -1) userStore.supportLevels.splice(idx, 1)
  }

  // ── CRUD: Support Categories ──
  async function createSupportCategory(payload) {
    error.value = null
    const created = await SupportCategoryRepository.create(payload)
    userStore.supportCategories.push(created)
    return created
  }

  async function updateSupportCategory(id, payload) {
    error.value = null
    const updated = await SupportCategoryRepository.update(id, payload)
    const idx = userStore.supportCategories.findIndex(sc => sc.id === id)
    if (idx !== -1) userStore.supportCategories[idx] = updated
    return updated
  }

  async function deleteSupportCategory(id) {
    error.value = null
    await SupportCategoryRepository.delete(id)
    const idx = userStore.supportCategories.findIndex(sc => sc.id === id)
    if (idx !== -1) userStore.supportCategories.splice(idx, 1)
  }

  // ── Hierarchy: App → Level pivots ──
  async function loadAppLevels(appId) {
    selectedAppId.value = appId
    selectedLevelId.value = null
    levelCategoryPivots.value = []
    if (!appId) { appLevelPivots.value = []; return }
    loadingPivots.value = true
    try {
      appLevelPivots.value = await ApplicationRepository.fetchSupportLevels(appId)
    } catch (e) {
      error.value = e.message || 'Error cargando niveles de la aplicación'
      appLevelPivots.value = []
    } finally {
      loadingPivots.value = false
    }
  }

  async function syncAppLevels(appId, levelIds) {
    error.value = null
    try {
      appLevelPivots.value = await ApplicationRepository.syncSupportLevels(appId, levelIds)
    } catch (e) {
      error.value = e.message || 'Error sincronizando niveles'
      throw e
    }
  }

  // ── Hierarchy: (App, Level) → Category pivots ──
  async function loadLevelCategories(levelId) {
    selectedLevelId.value = levelId
    if (!levelId || !selectedAppId.value) { levelCategoryPivots.value = []; return }
    loadingPivots.value = true
    try {
      levelCategoryPivots.value = await AppSupportLevelCategoryRepository.fetchAll(selectedAppId.value, levelId)
    } catch (e) {
      error.value = e.message || 'Error cargando categorías del nivel'
      levelCategoryPivots.value = []
    } finally {
      loadingPivots.value = false
    }
  }

  async function syncLevelCategories(levelId, categoryIds) {
    error.value = null
    try {
      levelCategoryPivots.value = await AppSupportLevelCategoryRepository.sync(selectedAppId.value, levelId, categoryIds)
    } catch (e) {
      error.value = e.message || 'Error sincronizando categorías'
      throw e
    }
  }

  return {
    roles, supportLevels, supportCategories,
    loading, error,
    // Hierarchy
    selectedAppId, selectedLevelId,
    appLevelPivots, levelCategoryPivots, loadingPivots,
    // Actions
    createSupportLevel, updateSupportLevel, deleteSupportLevel,
    createSupportCategory, updateSupportCategory, deleteSupportCategory,
    loadAppLevels, syncAppLevels,
    loadLevelCategories, syncLevelCategories,
  }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { RoleRepository } from '@/infrastructure/repositories/RoleRepository'
import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'
import { SupportCategoryRepository } from '@/infrastructure/repositories/SupportCategoryRepository'
import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'

export const useSettingsStore = defineStore('settings', () => {
  const roles = ref([])
  const supportLevels = ref([])
  const supportCategories = ref([])
  const loading = ref(false)
  const error = ref(null)

  // ── Hierarchy state ──
  const selectedAppId = ref(null)
  const selectedLevelId = ref(null)
  const appLevelPivots = ref([])       // pivot records for selected app
  const levelCategoryPivots = ref([])  // pivot records for selected level
  const loadingPivots = ref(false)

  async function loadRoles() {
    try {
      roles.value = await RoleRepository.fetchAll()
    } catch (e) {
      error.value = e.message || 'Error cargando roles'
    }
  }

  async function loadSupportLevels() {
    try {
      supportLevels.value = await SupportLevelRepository.fetchAll()
    } catch (e) {
      error.value = e.message || 'Error cargando niveles de soporte'
    }
  }

  async function loadSupportCategories() {
    try {
      supportCategories.value = await SupportCategoryRepository.fetchAll()
    } catch (e) {
      error.value = e.message || 'Error cargando categorías de soporte'
    }
  }

  async function loadAll() {
    loading.value = true
    error.value = null
    await Promise.all([loadRoles(), loadSupportLevels(), loadSupportCategories()])
    loading.value = false
  }

  // ── CRUD: Support Levels ──
  async function createSupportLevel(payload) {
    error.value = null
    const created = await SupportLevelRepository.create(payload)
    supportLevels.value.push(created)
    return created
  }

  async function updateSupportLevel(id, payload) {
    error.value = null
    const updated = await SupportLevelRepository.update(id, payload)
    const idx = supportLevels.value.findIndex(sl => sl.id === id)
    if (idx !== -1) supportLevels.value[idx] = updated
    return updated
  }

  async function deleteSupportLevel(id) {
    error.value = null
    await SupportLevelRepository.delete(id)
    supportLevels.value = supportLevels.value.filter(sl => sl.id !== id)
  }

  // ── CRUD: Support Categories ──
  async function createSupportCategory(payload) {
    error.value = null
    const created = await SupportCategoryRepository.create(payload)
    supportCategories.value.push(created)
    return created
  }

  async function updateSupportCategory(id, payload) {
    error.value = null
    const updated = await SupportCategoryRepository.update(id, payload)
    const idx = supportCategories.value.findIndex(sc => sc.id === id)
    if (idx !== -1) supportCategories.value[idx] = updated
    return updated
  }

  async function deleteSupportCategory(id) {
    error.value = null
    await SupportCategoryRepository.delete(id)
    supportCategories.value = supportCategories.value.filter(sc => sc.id !== id)
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

  // ── Hierarchy: Level → Category pivots ──
  async function loadLevelCategories(levelId) {
    selectedLevelId.value = levelId
    if (!levelId) { levelCategoryPivots.value = []; return }
    loadingPivots.value = true
    try {
      levelCategoryPivots.value = await SupportLevelRepository.fetchSupportCategories(levelId)
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
      levelCategoryPivots.value = await SupportLevelRepository.syncSupportCategories(levelId, categoryIds)
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
    loadAll, loadRoles, loadSupportLevels, loadSupportCategories,
    createSupportLevel, updateSupportLevel, deleteSupportLevel,
    createSupportCategory, updateSupportCategory, deleteSupportCategory,
    loadAppLevels, syncAppLevels,
    loadLevelCategories, syncLevelCategories,
  }
})

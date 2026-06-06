import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchUsersUseCase } from '@/application/use-cases/users/FetchUsersUseCase'
import { createUserUseCase } from '@/application/use-cases/users/CreateUserUseCase'
import { updateUserUseCase } from '@/application/use-cases/users/UpdateUserUseCase'
import { toggleUserStatusUseCase } from '@/application/use-cases/users/ToggleUserStatusUseCase'
import { deleteUserUseCase } from '@/application/use-cases/users/DeleteUserUseCase'
import { fetchRolesUseCase } from '@/application/use-cases/roles/FetchRolesUseCase'
import { fetchSupportLevelsUseCase } from '@/application/use-cases/support-levels/FetchSupportLevelsUseCase'
import { fetchSupportCategoriesUseCase } from '@/application/use-cases/support-categories/FetchSupportCategoriesUseCase'
import { fetchApplicationsUseCase } from '@/application/use-cases/applications/FetchApplicationsUseCase'
import { listSpecialistAppLevelsUseCase } from '@/application/use-cases/specialists/ListSpecialistAppLevelsUseCase'
import { syncSpecialistAppLevelsUseCase } from '@/application/use-cases/specialists/SyncSpecialistAppLevelsUseCase'
import { Application } from '@/domain/entities/Application'
import { SyncEngine } from '@/infrastructure/sync/SyncEngine'

const CACHE_VERSION = 'v2'
const CACHE_KEYS = {
  roles: `tyflow_roles_${CACHE_VERSION}`,
  supportLevels: `tyflow_support_levels_${CACHE_VERSION}`,
  supportCategories: `tyflow_support_categories_${CACHE_VERSION}`,
  applications: `tyflow_applications_${CACHE_VERSION}`,
}

// Limpiar claves de versiones anteriores
;['tyflow_roles', 'tyflow_support_levels', 'tyflow_specialists',
  'tyflow_specialists_v2'].forEach(k => localStorage.removeItem(k))

// ── SyncEngines por dataset ──
const appSync = new SyncEngine({
  cacheKey: CACHE_KEYS.applications,
  hydrate: (raw) => new Application(raw),
  fetchRemote: () => fetchApplicationsUseCase(),
  getId: (item) => item.id,
})

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)) || [] }
  catch { return [] }
}

function writeCache(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export const useUserStore = defineStore('users', () => {
  const users = ref([])
  const roles = ref(readCache(CACHE_KEYS.roles))
  const supportLevels = ref(readCache(CACHE_KEYS.supportLevels))
  const supportCategories = ref(readCache(CACHE_KEYS.supportCategories))
  const applications = ref(appSync.loadFromCache())
  const loading = ref(false)
  const loadingSelects = ref(false)
  const error = ref(null)

  // ── Specialist app-level state ──
  const specialistAppLevels = ref([])
  const loadingSpecialistPivots = ref(false)


  async function loadUsers() {
    const isFirstLoad = users.value.length === 0
    if (isFirstLoad) loading.value = true
    error.value = null
    try {
      users.value = await fetchUsersUseCase()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function loadSelects(force = false) {
    const hasCached = roles.value.length > 0 && supportLevels.value.length > 0 && supportCategories.value.length > 0 && applications.value.length > 0

    if (!force && hasCached) {
      // Cache disponible → UI inmediata, sync en background
      appSync.syncInBackground(applications)
      return
    }

    loadingSelects.value = true
    try {
      const [rolesData, supportLevelsData, supportCategoriesData, applicationsData] = await Promise.all([
        fetchRolesUseCase(),
        fetchSupportLevelsUseCase(),
        fetchSupportCategoriesUseCase(),
        fetchApplicationsUseCase(),
      ])
      roles.value = rolesData
      supportLevels.value = supportLevelsData
      supportCategories.value = supportCategoriesData
      writeCache(CACHE_KEYS.roles, rolesData)
      writeCache(CACHE_KEYS.supportLevels, supportLevelsData)
      writeCache(CACHE_KEYS.supportCategories, supportCategoriesData)
      appSync.replaceAll(applications, applicationsData)
    } finally {
      loadingSelects.value = false
    }
  }

  async function createUser(userData, options = {}) {
    const newUser = await createUserUseCase(userData)
    if (!options.skipReload) await loadUsers()
    return newUser
  }

  async function updateUser(userId, userData, options = {}) {
    const updated = await updateUserUseCase(userId, userData, options)
    if (!options.skipReload) await loadUsers()
    return updated
  }

  async function toggleStatus(userId) {
    const user = users.value.find((u) => u.id === userId)
    const updated = await toggleUserStatusUseCase(userId, user?.isActive ?? true)
    const idx = users.value.findIndex((u) => u.id === userId)
    if (idx !== -1) {
      users.value[idx].isActive = updated.isActive
    }
    return updated
  }

  async function deleteUser(userId) {
    await deleteUserUseCase(userId)
    users.value = users.value.filter((u) => u.id !== userId)
  }

  // ── Specialist ↔ App-Level (unified) ──

  async function loadSpecialistAppLevels(specialistId) {
    if (!specialistId) { specialistAppLevels.value = []; return }
    loadingSpecialistPivots.value = true
    try {
      specialistAppLevels.value = await listSpecialistAppLevelsUseCase(specialistId)
    } catch (e) {
      error.value = e.message || 'Error cargando app-levels del especialista'
      specialistAppLevels.value = []
    } finally {
      loadingSpecialistPivots.value = false
    }
  }

  async function syncSpecialistAppLevels(specialistId, entries) {
    error.value = null
    try {
      specialistAppLevels.value = await syncSpecialistAppLevelsUseCase(specialistId, entries)
    } catch (e) {
      error.value = e.message || 'Error sincronizando app-levels'
      throw e
    }
  }

  function updateApplicationInPlace(id, updated) {
    appSync.updateLocal(applications, id, updated)
  }

  function invalidateApplications() {
    applications.value = []
    appSync.clearCache()
  }

  function clearAll() {
    users.value = []
    roles.value = []
    supportLevels.value = []
    supportCategories.value = []
    applications.value = []
    appSync.clearCache()
    localStorage.removeItem(CACHE_KEYS.roles)
    localStorage.removeItem(CACHE_KEYS.supportLevels)
    localStorage.removeItem(CACHE_KEYS.supportCategories)
  }

  return {
    users,
    roles,
    supportLevels,
    supportCategories,
    applications,
    loading,
    loadingSelects,
    error,
    // Specialist app-levels
    specialistAppLevels,
    loadingSpecialistPivots,
    // Actions
    loadUsers,
    loadSelects,
    createUser,
    updateUser,
    toggleStatus,
    deleteUser,
    loadSpecialistAppLevels,
    syncSpecialistAppLevels,
    updateApplicationInPlace,
    invalidateApplications,
    clearAll,
  }
})

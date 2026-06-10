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
import { Application } from '@/domain/entities/Application'
import { User } from '@/domain/entities/User'
import { SyncEngine } from '@/infrastructure/sync/SyncEngine'

const CACHE_VERSION = 'v3'
const CACHE_KEYS = {
  users:            `tyflow_users_${CACHE_VERSION}`,
  roles:            `tyflow_roles_${CACHE_VERSION}`,
  supportLevels:    `tyflow_support_levels_${CACHE_VERSION}`,
  supportCategories:`tyflow_support_categories_${CACHE_VERSION}`,
  applications:     `tyflow_applications_${CACHE_VERSION}`,
}

// Limpiar claves de versiones anteriores
;['tyflow_roles', 'tyflow_support_levels', 'tyflow_specialists',
  'tyflow_specialists_v2',
  'tyflow_users_v2', 'tyflow_roles_v2', 'tyflow_support_levels_v2',
  'tyflow_support_categories_v2', 'tyflow_applications_v2',
].forEach(k => localStorage.removeItem(k))

// ── SyncEngines por dataset (módulo-level: singleton, persiste entre mounts) ──
const usersSync = new SyncEngine({
  cacheKey:    CACHE_KEYS.users,
  hydrate:     (raw) => new User(raw),
  fetchRemote: () => fetchUsersUseCase(),
  getId:       (u) => u.id,
  syncTtlMs:   60_000,   // 1 minuto — usuarios cambian con más frecuencia
})

const appSync = new SyncEngine({
  cacheKey:    CACHE_KEYS.applications,
  hydrate:     (raw) => new Application(raw),
  fetchRemote: () => fetchApplicationsUseCase(),
  getId:       (item) => item.id,
  syncTtlMs:   5 * 60_000, // 5 minutos — apps cambian muy poco
})

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)) || [] }
  catch { return [] }
}

function writeCache(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export const useUserStore = defineStore('users', () => {
  const users = ref(usersSync.loadFromCache())
  const roles = ref(readCache(CACHE_KEYS.roles))
  const supportLevels = ref(readCache(CACHE_KEYS.supportLevels))
  const supportCategories = ref(readCache(CACHE_KEYS.supportCategories))
  const applications = ref(appSync.loadFromCache())
  const loading = ref(false)
  const loadingSelects = ref(false)
  const error = ref(null)

  async function loadUsers({ force = false } = {}) {
    if (users.value.length === 0) loading.value = true
    try {
      // SyncEngine decide: si el TTL no expiró y hay datos, no va al backend.
      // Si necesita sync, hace merge CRDT (local reciente gana, backend gana si es más viejo).
      await usersSync.syncInBackground(users, { force })
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  let _loadSelectsPromise = null

  async function loadSelects(force = false) {
    const hasCached = roles.value.length > 0 && supportLevels.value.length > 0
      && supportCategories.value.length > 0 && applications.value.length > 0

    if (!force && hasCached) {
      // Cache disponible → UI inmediata, sync en background (deduplicado en SyncEngine)
      appSync.syncInBackground(applications)
      return
    }

    // Si ya hay un fetch en vuelo, esperar el mismo en lugar de duplicarlo
    if (_loadSelectsPromise) return _loadSelectsPromise

    loadingSelects.value = true
    _loadSelectsPromise = Promise.all([
      fetchRolesUseCase(),
      fetchSupportLevelsUseCase(),
      fetchSupportCategoriesUseCase(),
      fetchApplicationsUseCase(),
    ]).then(([rolesData, supportLevelsData, supportCategoriesData, applicationsData]) => {
      roles.value = rolesData
      supportLevels.value = supportLevelsData
      supportCategories.value = supportCategoriesData
      writeCache(CACHE_KEYS.roles, rolesData)
      writeCache(CACHE_KEYS.supportLevels, supportLevelsData)
      writeCache(CACHE_KEYS.supportCategories, supportCategoriesData)
      appSync.replaceAll(applications, applicationsData)
    }).finally(() => {
      loadingSelects.value = false
      _loadSelectsPromise = null
    })

    return _loadSelectsPromise
  }

  async function createUser(userData, options = {}) {
    const newUser = await createUserUseCase(userData)
    // newUser ya es una instancia User — insertar directo (no re-envolver).
    usersSync.insertLocal(users, newUser)
    if (!options.skipReload) usersSync.forceSync(users)
    return newUser
  }

  async function updateUser(userId, userData, options = {}) {
    const updated = await updateUserUseCase(userId, userData, options)
    // Replace directly WITHOUT _localUpdatedAt: PATCH response may not include
    // computed fields (application_assignments, support_level_names). Storing it
    // with CRDT protection would block the next sync from overwriting with full data.
    if (updated) {
      // updated ya es una instancia User devuelta por el repo — usar directo.
      const fresh = updated
      const idx = users.value.findIndex(u => u.id === userId)
      if (idx !== -1) {
        users.value = [
          ...users.value.slice(0, idx),
          fresh,
          ...users.value.slice(idx + 1),
        ]
        usersSync.writeToCache(users.value)
      }
    }
    if (!options.skipReload) usersSync.forceSync(users)
    return updated
  }

  async function toggleStatus(userId) {
    const user = users.value.find((u) => u.id === userId)
    // El use-case ya devuelve una instancia User; NO re-envolver (new User(userInstance)
    // lee claves snake_case inexistentes y deja todos los campos en undefined).
    const updated = await toggleUserStatusUseCase(userId, user?.isActive ?? true)
    // Mutación optimista vía SyncEngine — marca _localUpdatedAt para CRDT
    usersSync.updateLocal(users, userId, updated)
    return updated
  }

  async function deleteUser(userId) {
    await deleteUserUseCase(userId)
    usersSync.removeLocal(users, userId)
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
    usersSync.clearCache()
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
    // Actions
    loadUsers,
    loadSelects,
    createUser,
    updateUser,
    toggleStatus,
    deleteUser,
    updateApplicationInPlace,
    invalidateApplications,
    clearAll,
  }
})

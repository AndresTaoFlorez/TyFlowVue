import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchUsersUseCase } from '@/application/use-cases/users/FetchUsersUseCase'
import { createUserUseCase } from '@/application/use-cases/users/CreateUserUseCase'
import { updateUserUseCase } from '@/application/use-cases/users/UpdateUserUseCase'
import { toggleUserStatusUseCase } from '@/application/use-cases/users/ToggleUserStatusUseCase'
import { deleteUserUseCase } from '@/application/use-cases/users/DeleteUserUseCase'
import { fetchRolesUseCase } from '@/application/use-cases/roles/FetchRolesUseCase'
import { fetchSupportLevelsUseCase } from '@/application/use-cases/support-levels/FetchSupportLevelsUseCase'
import { fetchApplicationsUseCase } from '@/application/use-cases/applications/FetchApplicationsUseCase'

const CACHE_VERSION = 'v2'
const STORE_CACHE_KEYS = {
  roles: `tyflow_roles_${CACHE_VERSION}`,
  supportLevels: `tyflow_support_levels_${CACHE_VERSION}`,
  applications: `tyflow_applications_${CACHE_VERSION}`,
}

// Limpiar claves de versiones anteriores
;['tyflow_roles', 'tyflow_support_levels', 'tyflow_specialists',
  'tyflow_specialists_v2'].forEach(k => localStorage.removeItem(k))

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || []
  } catch {
    return []
  }
}

function writeCache(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export const useUserStore = defineStore('users', () => {
  const users = ref([])
  const roles = ref(readCache(STORE_CACHE_KEYS.roles))
  const supportLevels = ref(readCache(STORE_CACHE_KEYS.supportLevels))
  const applications = ref(readCache(STORE_CACHE_KEYS.applications))
  const loading = ref(false)
  const loadingSelects = ref(false)
  const error = ref(null)

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
    if (!force && roles.value.length > 0 && supportLevels.value.length > 0 && applications.value.length > 0) return
    loadingSelects.value = true
    try {
      const [rolesData, supportLevelsData, applicationsData] = await Promise.all([
        fetchRolesUseCase(),
        fetchSupportLevelsUseCase(),
        fetchApplicationsUseCase(),
      ])
      roles.value = rolesData
      supportLevels.value = supportLevelsData
      applications.value = applicationsData
      writeCache(STORE_CACHE_KEYS.roles, rolesData)
      writeCache(STORE_CACHE_KEYS.supportLevels, supportLevelsData)
      writeCache(STORE_CACHE_KEYS.applications, applicationsData)
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

  function invalidateApplications() {
    applications.value = []
    localStorage.removeItem(STORE_CACHE_KEYS.applications)
  }

  function clearAll() {
    users.value = []
    roles.value = []
    supportLevels.value = []
    applications.value = []
    Object.values(STORE_CACHE_KEYS).forEach(key => localStorage.removeItem(key))
  }

  return {
    users,
    roles,
    supportLevels,
    applications,
    loading,
    loadingSelects,
    error,
    loadUsers,
    loadSelects,
    createUser,
    updateUser,
    toggleStatus,
    deleteUser,
    invalidateApplications,
    clearAll,
  }
})

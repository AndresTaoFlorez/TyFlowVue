import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchUsersUseCase } from '@/application/use-cases/users/FetchUsersUseCase'
import { createUserUseCase } from '@/application/use-cases/users/CreateUserUseCase'
import { updateUserUseCase } from '@/application/use-cases/users/UpdateUserUseCase'
import { toggleUserStatusUseCase } from '@/application/use-cases/users/ToggleUserStatusUseCase'
import { deleteUserUseCase } from '@/application/use-cases/users/DeleteUserUseCase'
import { fetchRolesUseCase } from '@/application/use-cases/roles/FetchRolesUseCase'
import { fetchAreasUseCase } from '@/application/use-cases/areas/FetchAreasUseCase'

export const useUserStore = defineStore('users', () => {
  const users = ref([])
  const roles = ref([])
  const areas = ref([])
  const loading = ref(false)
  const loadingSelects = ref(false)
  const error = ref(null)

  async function loadUsers() {
    // Solo mostrar skeleton en la carga inicial (sin datos previos)
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

  async function loadSelects() {
    // No recargar si ya se tienen roles y áreas
    if (roles.value.length > 0 && areas.value.length > 0) return
    loadingSelects.value = true
    try {
      const [rolesData, areasData] = await Promise.all([
        fetchRolesUseCase(),
        fetchAreasUseCase(),
      ])
      roles.value = rolesData
      areas.value = areasData
    } finally {
      loadingSelects.value = false
    }
  }

  async function createUser(userData) {
    const newUser = await createUserUseCase(userData)
    await loadUsers()
    return newUser
  }

  async function updateUser(userId, userData, options = {}) {
    const updated = await updateUserUseCase(userId, userData, options)
    if (!options.skipReload) await loadUsers()
    return updated
  }

  async function toggleStatus(userId) {
    const updated = await toggleUserStatusUseCase(userId)
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

  return {
    users,
    roles,
    areas,
    loading,
    loadingSelects,
    error,
    loadUsers,
    loadSelects,
    createUser,
    updateUser,
    toggleStatus,
    deleteUser,
  }
})

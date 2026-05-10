import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchUsersUseCase } from '@/application/use-cases/users/FetchUsersUseCase'
import { createUserUseCase } from '@/application/use-cases/users/CreateUserUseCase'
import { updateUserUseCase } from '@/application/use-cases/users/UpdateUserUseCase'
import { toggleUserStatusUseCase } from '@/application/use-cases/users/ToggleUserStatusUseCase'
import { fetchRolesUseCase } from '@/application/use-cases/roles/FetchRolesUseCase'
import { fetchAreasUseCase } from '@/application/use-cases/areas/FetchAreasUseCase'

export const useUserStore = defineStore('users', () => {
  const users = ref([])
  const roles = ref([])
  const areas = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadUsers() {
    loading.value = true
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
    const [rolesData, areasData] = await Promise.all([
      fetchRolesUseCase(),
      fetchAreasUseCase(),
    ])
    roles.value = rolesData
    areas.value = areasData
  }

  async function createUser(userData) {
    const newUser = await createUserUseCase(userData)
    await loadUsers()
    return newUser
  }

  async function updateUser(userId, userData) {
    const updated = await updateUserUseCase(userId, {
      first_name: userData.firstName || undefined,
      second_name: userData.secondName || undefined,
      first_surname: userData.firstSurname || undefined,
      second_surname: userData.secondSurname || undefined,
      document_number: userData.documentNumber || undefined,
      role_ids: userData.roleIds?.length ? userData.roleIds : undefined,
      area_ids: userData.areaIds?.length ? userData.areaIds : undefined,
    })
    await loadUsers()
    return updated
  }

  async function toggleStatus(userId) {
    const updated = await toggleUserStatusUseCase(userId)
    const idx = users.value.findIndex((u) => u.id === userId)
    if (idx !== -1) users.value[idx] = updated
    return updated
  }

  return {
    users,
    roles,
    areas,
    loading,
    error,
    loadUsers,
    loadSelects,
    createUser,
    updateUser,
    toggleStatus,
  }
})

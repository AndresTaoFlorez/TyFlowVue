import { defineStore } from 'pinia'
import { ref } from 'vue'
import { RoleRepository } from '@/infrastructure/repositories/RoleRepository'
import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'

export const useSettingsStore = defineStore('settings', () => {
  const roles = ref([])
  const supportLevels = ref([])
  const loading = ref(false)
  const error = ref(null)

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

  async function loadAll() {
    loading.value = true
    error.value = null
    await Promise.all([loadRoles(), loadSupportLevels()])
    loading.value = false
  }

  async function createSupportLevel(payload) {
    error.value = null
    const created = await SupportLevelRepository.create(payload)
    supportLevels.value.push(created)
    return created
  }

  async function deleteSupportLevel(id) {
    error.value = null
    await SupportLevelRepository.delete(id)
    supportLevels.value = supportLevels.value.filter(sl => sl.id !== id)
  }

  return {
    roles,
    supportLevels,
    loading,
    error,
    loadAll,
    loadRoles,
    loadSupportLevels,
    createSupportLevel,
    deleteSupportLevel,
  }
})

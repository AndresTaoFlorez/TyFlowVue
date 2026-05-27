import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { fetchApplicationsUseCase } from '@/application/use-cases/applications/FetchApplicationsUseCase'
import { createApplicationUseCase } from '@/application/use-cases/applications/CreateApplicationUseCase'
import { updateApplicationUseCase } from '@/application/use-cases/applications/UpdateApplicationUseCase'
import { deleteApplicationUseCase } from '@/application/use-cases/applications/DeleteApplicationUseCase'
import { fetchFoldersUseCase } from '@/application/use-cases/folders/FetchFoldersUseCase'
import { createFolderUseCase } from '@/application/use-cases/folders/CreateFolderUseCase'
import { updateFolderUseCase } from '@/application/use-cases/folders/UpdateFolderUseCase'
import { deleteFolderUseCase } from '@/application/use-cases/folders/DeleteFolderUseCase'
import { fetchApplicationSpecialistsUseCase } from '@/application/use-cases/applications/FetchApplicationSpecialistsUseCase'

export const useApplicationStore = defineStore('applications', () => {
  const applications = ref([])
  const foldersMap = reactive({})
  const specialistsMap = reactive({})
  const selectedAppId = ref(null)
  const selectedFolderId = ref(null)
  const expandedAppIds = ref(new Set())
  const collapsedMainBoxIds = ref(new Set())
  const loading = ref(false)
  const loadingFolders = ref(false)
  const error = ref(null)

  const selectedApp = computed(() =>
    applications.value.find((a) => a.id === selectedAppId.value) || null
  )

  // ---- Applications ----

  async function loadApplications({ force = false } = {}) {
    if (!force && applications.value.length > 0) return
    loading.value = true
    error.value = null
    try {
      applications.value = await fetchApplicationsUseCase()
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createApplication(name) {
    const newApp = await createApplicationUseCase(name)
    applications.value.push(newApp)
    return newApp
  }

  async function updateApplication(id, payload) {
    const updated = await updateApplicationUseCase(id, payload)
    const idx = applications.value.findIndex((a) => a.id === id)
    if (idx !== -1) applications.value[idx] = updated
    return updated
  }

  async function deleteApplication(id) {
    await deleteApplicationUseCase(id)
    applications.value = applications.value.filter((a) => a.id !== id)
    delete foldersMap[id]
    delete specialistsMap[id]
    if (selectedAppId.value === id) {
      selectedAppId.value = null
      selectedFolderId.value = null
    }
    expandedAppIds.value.delete(id)
  }

  // ---- Folders ----

  async function loadFolders(appId) {
    if (foldersMap[appId]) return
    loadingFolders.value = true
    try {
      foldersMap[appId] = await fetchFoldersUseCase(appId)
    } finally {
      loadingFolders.value = false
    }
  }

  async function createFolder(appId, data) {
    const folder = await createFolderUseCase({ applicationId: appId, ...data })
    if (!foldersMap[appId]) foldersMap[appId] = []
    foldersMap[appId].push(folder)
    return folder
  }

  async function updateFolder(appId, folderId, data) {
    const updated = await updateFolderUseCase(folderId, data)
    if (foldersMap[appId]) {
      const idx = foldersMap[appId].findIndex((f) => f.id === folderId)
      if (idx !== -1) foldersMap[appId][idx] = updated
    }
    return updated
  }

  async function deleteFolder(appId, folderId) {
    await deleteFolderUseCase(folderId)
    if (foldersMap[appId]) {
      foldersMap[appId] = foldersMap[appId].filter((f) => f.id !== folderId)
    }
    if (selectedFolderId.value === folderId) {
      selectedFolderId.value = null
    }
  }

  // ---- Specialists ----

  async function loadSpecialists(appId) {
    if (specialistsMap[appId]) return
    specialistsMap[appId] = await fetchApplicationSpecialistsUseCase(appId)
  }

  function assignSpecialist(appId, user) {
    if (!specialistsMap[appId]) specialistsMap[appId] = []
    specialistsMap[appId].push(user)
  }

  function removeSpecialist(appId, userId) {
    if (specialistsMap[appId]) {
      specialistsMap[appId] = specialistsMap[appId].filter((u) => u.id !== userId)
    }
  }

  // ---- Selection ----

  async function selectApp(appId) {
    selectedAppId.value = appId
    selectedFolderId.value = null
    if (appId) {
      await Promise.all([loadFolders(appId), loadSpecialists(appId)])
    }
  }

  function selectFolder(folderId) {
    selectedFolderId.value = folderId
  }

  function toggleExpandApp(appId) {
    if (expandedAppIds.value.has(appId)) {
      expandedAppIds.value.delete(appId)
    } else {
      expandedAppIds.value.add(appId)
    }
  }

  function toggleMainBoxCollapse(folderId) {
    if (collapsedMainBoxIds.value.has(folderId)) {
      collapsedMainBoxIds.value.delete(folderId)
    } else {
      collapsedMainBoxIds.value.add(folderId)
    }
  }

  // ---- Invalidation ----

  function invalidateApp(appId) {
    delete foldersMap[appId]
    delete specialistsMap[appId]
  }

  function clearAll() {
    applications.value = []
    Object.keys(foldersMap).forEach((k) => delete foldersMap[k])
    Object.keys(specialistsMap).forEach((k) => delete specialistsMap[k])
    selectedAppId.value = null
    selectedFolderId.value = null
    expandedAppIds.value.clear()
  }

  return {
    applications,
    foldersMap,
    specialistsMap,
    selectedAppId,
    selectedFolderId,
    expandedAppIds,
    collapsedMainBoxIds,
    loading,
    loadingFolders,
    error,
    selectedApp,
    loadApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    loadFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    loadSpecialists,
    assignSpecialist,
    removeSpecialist,
    selectApp,
    selectFolder,
    toggleExpandApp,
    toggleMainBoxCollapse,
    invalidateApp,
    clearAll,
  }
})

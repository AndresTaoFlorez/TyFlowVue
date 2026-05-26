<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { fetchApplicationsUseCase } from '@/application/use-cases/applications/FetchApplicationsUseCase'
import { fetchAppSpecialistsUseCase } from '@/application/use-cases/applications/FetchAppSpecialistsUseCase'
import { updateUserUseCase } from '@/application/use-cases/users/UpdateUserUseCase'
import { fetchFoldersUseCase } from '@/application/use-cases/folders/FetchFoldersUseCase'
import { createFolderUseCase } from '@/application/use-cases/folders/CreateFolderUseCase'
import { updateFolderUseCase } from '@/application/use-cases/folders/UpdateFolderUseCase'
import { deleteFolderUseCase } from '@/application/use-cases/folders/DeleteFolderUseCase'
import { updateApplicationUseCase } from '@/application/use-cases/applications/UpdateApplicationUseCase'
import FolderTree from '@/presentation/components/FolderTree.vue'
import CreateFolderModal from '@/presentation/components/CreateFolderModal.vue'
import SectionLoader from '@/presentation/components/SectionLoader.vue'
import ToastNotification from '@/presentation/components/ToastNotification.vue'
import logger from '@/infrastructure/logger'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const authStore = useAuthStore()

// ---- State ----
const application = ref(null)
const loadingApp = ref(true)
const activeTab = ref('folders')

// Specialists
const specialists = ref([])
const loadingSpecialists = ref(false)
const assigning = ref(false)
const busquedaSpec = ref('')
const mostrarBusquedaSpec = ref(false)

// Folders
const folders = ref([])
const loadingFolders = ref(false)
const mostrarCrearFolder = ref(false)
const creandoFolder = ref(false)
const errorCrearFolder = ref('')
const prefillFolder = ref(null)
const editingFolder = ref(null)
const confirmandoEliminar = ref(null)

// Toast
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')
const showToast = (msg, type = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
}

// ---- Load application ----
const loadApplication = async () => {
  loadingApp.value = true
  try {
    const apps = await fetchApplicationsUseCase()
    application.value = apps.find(a => a.id === route.params.id) || null
    if (!application.value) {
      router.replace({ name: 'applications' })
    }
  } catch (e) {
    logger.error('[AppDetail] Error cargando aplicación:', e)
    showToast('Error al cargar la aplicación.', 'error')
  } finally {
    loadingApp.value = false
  }
}

// ---- Specialists ----
const loadSpecialists = async () => {
  loadingSpecialists.value = true
  try {
    specialists.value = await fetchAppSpecialistsUseCase(route.params.id)
  } catch (e) {
    logger.error('[AppDetail] Error cargando especialistas:', e)
    specialists.value = []
  } finally {
    loadingSpecialists.value = false
  }
}

const assignedUserIds = computed(() => new Set(specialists.value.map(u => u.id)))

const usuariosDisponibles = computed(() => {
  const term = busquedaSpec.value.toLowerCase().trim()
  return userStore.users.filter(u => {
    if (!u.specialistId) return false
    if (assignedUserIds.value.has(u.id)) return false
    if (!term) return true
    return u.fullName.toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term)
  })
})

const handleAssign = async (user) => {
  assigning.value = true
  try {
    const currentAppIds = user.applicationAssignments.map(a => a.application_id)
    const newAppIds = [...currentAppIds, route.params.id]
    await updateUserUseCase(user.id, {
      firstName: user.firstName,
      secondName: user.secondName,
      firstSurname: user.firstSurname,
      secondSurname: user.secondSurname,
      documentNumber: user.documentNumber,
      applicationIds: newAppIds,
    })
    specialists.value = [...specialists.value, user]
    userStore.loadUsers() // background sync
    showToast(`${user.fullName} asignado correctamente.`)
  } catch (e) {
    logger.error('[AppDetail] Error asignando especialista:', e)
    showToast(e.userMessage || 'Error al asignar especialista.', 'error')
  } finally {
    assigning.value = false
  }
}

const handleRemove = async (user) => {
  try {
    const currentAppIds = user.applicationAssignments.map(a => a.application_id)
    const newAppIds = currentAppIds.filter(id => id !== route.params.id)
    await updateUserUseCase(user.id, {
      firstName: user.firstName,
      secondName: user.secondName,
      firstSurname: user.firstSurname,
      secondSurname: user.secondSurname,
      documentNumber: user.documentNumber,
      applicationIds: newAppIds,
    })
    specialists.value = specialists.value.filter(s => s.id !== user.id)
    userStore.loadUsers() // background sync
    showToast('Especialista removido de la aplicación.')
  } catch (e) {
    logger.error('[AppDetail] Error removiendo especialista:', e)
    showToast(e.userMessage || 'Error al remover especialista.', 'error')
  }
}

// ---- Folders ----
const loadFolders = async () => {
  const isFirstLoad = folders.value.length === 0
  if (isFirstLoad) loadingFolders.value = true
  try {
    folders.value = await fetchFoldersUseCase(route.params.id)
  } catch (e) {
    logger.error('[AppDetail] Error cargando carpetas:', e)
    folders.value = []
    showToast('Error al cargar carpetas.', 'error')
  } finally {
    loadingFolders.value = false
  }
}

const openCreateFolder = (prefill = null) => {
  prefillFolder.value = prefill
  errorCrearFolder.value = ''
  mostrarCrearFolder.value = true
}

const handleCreateFolder = async (data) => {
  creandoFolder.value = true
  errorCrearFolder.value = ''
  try {
    const created = await createFolderUseCase({ ...data, applicationId: route.params.id })
    folders.value = [...folders.value, created]
    mostrarCrearFolder.value = false
    prefillFolder.value = null
    showToast('Carpeta creada.')
  } catch (e) {
    logger.error('[AppDetail] Error creando carpeta:', e)
    errorCrearFolder.value = e.userMessage || 'Error al crear la carpeta.'
  } finally {
    creandoFolder.value = false
  }
}

const handleEditFolder = async (folder, newName) => {
  try {
    await updateFolderUseCase(folder.id, { name: newName })
    const idx = folders.value.findIndex(f => f.id === folder.id)
    if (idx !== -1) {
      const updated = { ...folders.value[idx], name: newName }
      folders.value = [...folders.value.slice(0, idx), updated, ...folders.value.slice(idx + 1)]
    }
    editingFolder.value = null
    showToast('Carpeta actualizada.')
  } catch (e) {
    logger.error('[AppDetail] Error actualizando carpeta:', e)
    showToast(e.userMessage || 'Error al actualizar la carpeta.', 'error')
  }
}

const confirmarEliminarFolder = (folder) => {
  confirmandoEliminar.value = folder
}

const ejecutarEliminarFolder = async () => {
  const folder = confirmandoEliminar.value
  if (!folder) return
  try {
    await deleteFolderUseCase(folder.id)
    folders.value = folders.value.filter(f => f.id !== folder.id)
    confirmandoEliminar.value = null
    showToast('Carpeta eliminada.')
  } catch (e) {
    logger.error('[AppDetail] Error eliminando carpeta:', e)
    const msg = e.response?.status === 409
      ? 'No se puede eliminar: la carpeta tiene conversaciones asignadas.'
      : (e.userMessage || 'Error al eliminar la carpeta.')
    showToast(msg, 'error')
    confirmandoEliminar.value = null
  }
}

// ---- Color ----
const handleColorChange = async (e) => {
  const color = e.target.value
  try {
    await updateApplicationUseCase(route.params.id, { theme: { color } })
    application.value = { ...application.value, theme: { color } }
    userStore.invalidateApplications()
  } catch (err) {
    logger.error('[AppDetail] Error actualizando color:', err)
    showToast('Error al actualizar color.', 'error')
  }
}

// ---- Navigation ----
const goBack = () => router.push({ name: 'applications' })

// ---- ESC ----
const onEsc = (e) => {
  if (e.key === 'Escape') {
    if (confirmandoEliminar.value) confirmandoEliminar.value = null
    else if (mostrarCrearFolder.value) { mostrarCrearFolder.value = false; errorCrearFolder.value = '' }
  }
}

onMounted(() => {
  loadApplication()
  loadSpecialists()
  loadFolders()
  userStore.loadUsers()
  userStore.loadSelects()
  window.addEventListener('keydown', onEsc)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <section class="content">
    <!-- Loading -->
    <SectionLoader v-if="loadingApp" message="Cargando aplicación..." />

    <template v-else-if="application">
      <!-- Header -->
      <div class="app-header">
        <button class="app-header__back" @click="goBack" title="Volver">
          <i class='bx bx-arrow-back'></i>
        </button>
        <label class="app-header__icon" :style="application.theme?.color ? { background: application.theme.color } : {}">
          <i class='bx bx-cube'></i>
          <input
            v-if="authStore.isAdmin"
            type="color"
            class="app-header__color-input"
            :value="application.theme?.color || '#2AC78F'"
            @change="handleColorChange"
          >
        </label>
        <div class="app-header__info">
          <h1 class="app-header__name">{{ application.name }}</h1>
          <span class="app-header__meta">ID: {{ application.id }}</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tabs__btn"
          :class="{ 'tabs__btn--active': activeTab === 'folders' }"
          @click="activeTab = 'folders'"
        >
          <i class='bx bx-folder'></i>
          Carpetas
          <span class="tabs__badge">{{ folders.length }}</span>
        </button>
        <button
          class="tabs__btn"
          :class="{ 'tabs__btn--active': activeTab === 'specialists' }"
          @click="activeTab = 'specialists'"
        >
          <i class='bx bx-user'></i>
          Especialistas
          <span class="tabs__badge">{{ specialists.length }}</span>
        </button>
      </div>

      <!-- Tab: Folders -->
      <div v-if="activeTab === 'folders'" class="tab-content">
        <div class="tab-toolbar">
          <p class="tab-toolbar__hint">Estructura jerárquica de carpetas de la aplicación.</p>
          <button v-if="authStore.isAdmin" class="btn-create-sm" @click="openCreateFolder()">
            <i class='bx bx-plus'></i> Nueva Carpeta
          </button>
        </div>

        <SectionLoader v-if="loadingFolders" message="Cargando carpetas..." />

        <div v-else-if="folders.length === 0" class="empty-state">
          <i class='bx bx-folder-open'></i>
          <p>No hay carpetas configuradas.</p>
          <span v-if="authStore.isAdmin" class="empty-state__action" @click="openCreateFolder()">Crear primera carpeta</span>
        </div>

        <FolderTree
          v-else
          :folders="folders"
          :specialists="userStore.users"
          :support-levels="userStore.supportLevels"
          :editable="authStore.isAdmin"
          @add-child="openCreateFolder"
          @edit="editingFolder = $event"
          @delete="confirmarEliminarFolder"
          @rename="handleEditFolder"
        />
      </div>

      <!-- Tab: Specialists -->
      <div v-if="activeTab === 'specialists'" class="tab-content">
        <div class="tab-toolbar">
          <p class="tab-toolbar__hint">Especialistas asignados a esta aplicación.</p>
          <button v-if="authStore.isAdmin" class="btn-create-sm" @click="mostrarBusquedaSpec = !mostrarBusquedaSpec">
            <i :class="mostrarBusquedaSpec ? 'bx bx-x' : 'bx bx-plus'"></i>
            {{ mostrarBusquedaSpec ? 'Cerrar' : 'Agregar' }}
          </button>
        </div>

        <!-- Search & assign -->
        <div v-if="mostrarBusquedaSpec" class="search-panel">
          <div class="search-panel__input-wrap">
            <i class='bx bx-search'></i>
            <input v-model="busquedaSpec" type="text" placeholder="Buscar especialista..." class="search-panel__input">
          </div>
          <div v-if="assigning" class="search-panel__status">
            <i class='bx bx-loader-alt bx-spin'></i> Asignando...
          </div>
          <div v-else-if="usuariosDisponibles.length === 0" class="search-panel__empty">
            {{ busquedaSpec.trim() ? 'No se encontraron especialistas.' : 'No hay especialistas disponibles.' }}
          </div>
          <ul v-else class="search-panel__results">
            <li v-for="user in usuariosDisponibles" :key="user.id" class="search-result" @click="handleAssign(user)">
              <div class="search-result__avatar">{{ user.firstName?.charAt(0) }}{{ user.firstSurname?.charAt(0) }}</div>
              <div class="search-result__info">
                <span class="search-result__name">{{ user.fullName }}</span>
                <span class="search-result__email">{{ user.email }}</span>
              </div>
              <i class='bx bx-plus-circle search-result__action'></i>
            </li>
          </ul>
        </div>

        <SectionLoader v-if="loadingSpecialists" message="Cargando especialistas..." />

        <ul v-else-if="specialists.length > 0" class="specialist-list">
          <li v-for="user in specialists" :key="user.id" class="specialist-item">
            <div class="specialist-item__avatar">{{ user.firstName?.charAt(0) }}{{ user.firstSurname?.charAt(0) }}</div>
            <div class="specialist-item__info">
              <span class="specialist-item__name">{{ user.fullName }}</span>
              <span class="specialist-item__email">{{ user.email }}</span>
            </div>
            <button v-if="authStore.isAdmin" class="specialist-item__remove" @click="handleRemove(user)" title="Quitar">
              <i class='bx bx-x'></i>
            </button>
          </li>
        </ul>

        <div v-else class="empty-state">
          <i class='bx bx-user-x'></i>
          <p>No hay especialistas asignados.</p>
        </div>
      </div>
    </template>

    <!-- Delete confirmation -->
    <div v-if="confirmandoEliminar" class="modal-overlay" @click.self="confirmandoEliminar = null">
      <div class="modal-content modal-content--sm">
        <div class="modal-header">
          <h2>Eliminar Carpeta</h2>
          <button @click="confirmandoEliminar = null" class="btn-close"><i class='bx bx-x'></i></button>
        </div>
        <div class="confirm-body">
          <div class="confirm-icon"><i class='bx bx-error-circle'></i></div>
          <p>¿Eliminar <strong>{{ confirmandoEliminar.name }}</strong>?</p>
          <p class="confirm-hint">Las sub-carpetas quedarán sin padre. Falla si tiene conversaciones asignadas.</p>
        </div>
        <div class="modal-actions">
          <button @click="confirmandoEliminar = null" class="btn-secondary">Cancelar</button>
          <button @click="ejecutarEliminarFolder" class="btn-danger"><i class='bx bx-trash'></i> Eliminar</button>
        </div>
      </div>
    </div>

    <!-- Create folder modal -->
    <CreateFolderModal
      :visible="mostrarCrearFolder"
      :creating="creandoFolder"
      :error="errorCrearFolder"
      :folders="folders"
      :specialists="userStore.users.filter(u => u.specialistId)"
      :support-levels="userStore.supportLevels"
      :prefill="prefillFolder"
      @close="mostrarCrearFolder = false; errorCrearFolder = ''; prefillFolder = null"
      @create="handleCreateFolder"
    />

    <ToastNotification
      :visible="toastVisible"
      :message="toastMessage"
      :type="toastType"
      @close="toastVisible = false"
    />
  </section>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ---- Header ---- */
.app-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.app-header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  background: none;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.15s;
}

.app-header__back:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
}

.app-header__icon {
  position: relative;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.35rem;
  flex-shrink: 0;
  cursor: pointer;
  transition: filter 0.15s;
}

.app-header__icon:hover { filter: brightness(1.1); }

.app-header__color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.app-header__name {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
}

.app-header__meta {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-family: monospace;
}

/* ---- Tabs ---- */
.tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 0;
}

.tabs__btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: all 0.15s;
}

.tabs__btn:hover {
  color: var(--text-primary);
}

.tabs__btn--active {
  color: var(--primary-500);
  border-bottom-color: var(--primary-500);
}

.tabs__btn i {
  font-size: 1.1rem;
}

.tabs__badge {
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-full);
}

.tabs__btn--active .tabs__badge {
  background: rgba(42, 199, 143, 0.1);
  color: var(--primary-500);
}

/* ---- Tab content ---- */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tab-toolbar__hint {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.btn-create-sm {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1.5px solid var(--primary-500);
  color: var(--primary-500);
  background: white;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-create-sm:hover {
  background: var(--primary-500);
  color: white;
}

/* ---- Empty ---- */
.empty-state {
  text-align: center;
  padding: 4rem 1rem 3rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.empty-state i {
  font-size: 2rem;
  opacity: 0.18;
  margin-bottom: 0.25rem;
}

.empty-state p {
  font-size: 0.82rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

.empty-state__action {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--primary-500);
  cursor: pointer;
  margin-top: 0.35rem;
  transition: opacity 0.15s;
}

.empty-state__action:hover {
  opacity: 0.7;
}

/* ---- Search panel ---- */
.search-panel {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-panel__input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
}

.search-panel__input-wrap i {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.search-panel__input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.85rem;
  background: transparent;
  color: var(--text-primary);
}

.search-panel__status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  padding: 0.5rem 0;
}

.search-panel__empty {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-style: italic;
  padding: 0.5rem 0;
  text-align: center;
}

.search-panel__results {
  list-style: none;
  max-height: 12rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.search-result {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s;
}

.search-result:hover { background: white; }

.search-result__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: #E0E7FF;
  color: #4F46E5;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}

.search-result__info { flex: 1; min-width: 0; }
.search-result__name { display: block; font-size: 0.82rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-result__email { display: block; font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-result__action { font-size: 1.2rem; color: var(--primary-500); flex-shrink: 0; }

/* ---- Specialist list ---- */
.specialist-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.specialist-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.6rem;
  border-radius: var(--radius-sm);
  transition: background 0.12s;
}

.specialist-item:hover { background: var(--bg-card); }

.specialist-item__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--primary-gradient);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}

.specialist-item__info { flex: 1; min-width: 0; }
.specialist-item__name { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); }
.specialist-item__email { display: block; font-size: 0.72rem; color: var(--text-secondary); }

.specialist-item__remove {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all 0.12s;
}

.specialist-item:hover .specialist-item__remove { opacity: 1; }
.specialist-item__remove:hover { color: var(--error-500); background: var(--error-bg); }

/* ---- Modal ---- */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  box-shadow: var(--shadow-lg);
}

.modal-content--sm { max-width: 400px; width: 100%; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-header h2 { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); }

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.confirm-body { text-align: center; padding: 0.5rem 0; }
.confirm-icon { font-size: 2.5rem; color: var(--error-500); margin-bottom: 0.75rem; }
.confirm-body p { font-size: 0.9rem; color: var(--text-primary); line-height: 1.4; }
.confirm-hint { font-size: 0.8rem !important; color: var(--text-secondary) !important; margin-top: 0.4rem; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  background: white;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-danger {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.55rem 1rem;
  background: var(--error-500);
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-danger:hover { background: #DC2626; }
</style>

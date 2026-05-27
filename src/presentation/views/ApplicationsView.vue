<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useApplicationStore } from '@/presentation/stores/useApplicationStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import FolderTree from '@/presentation/components/FolderTree.vue'
import CreateApplicationModal from '@/presentation/components/CreateApplicationModal.vue'
import CreateFolderModal from '@/presentation/components/CreateFolderModal.vue'
import ConversationPanel from '@/presentation/components/ConversationPanel.vue'
import ContextMenu from '@/presentation/components/ContextMenu.vue'
import ManageSpecialistsModal from '@/presentation/components/ManageSpecialistsModal.vue'
import SectionLoader from '@/presentation/components/SectionLoader.vue'
import ToastNotification from '@/presentation/components/ToastNotification.vue'

const appStore = useApplicationStore()
const userStore = useUserStore()

const busqueda = ref('')
const mostrarCrearApp = ref(false)
const creandoApp = ref(false)
const errorCrearApp = ref('')

const mostrarCrearFolder = ref(false)
const folderContext = ref(null)

const mostrarSpecialists = ref(false)
const specialistsAppId = ref(null)

const renamingNode = ref(null)
const renameValue = ref('')

const confirmandoEliminar = ref(null)
const confirmandoEliminarTipo = ref(null)

const colorPickerAppId = ref(null)
const colorPickerValue = ref('')

const contextMenu = ref({ visible: false, x: 0, y: 0, items: [], node: null })

const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const showToast = (message, type = 'success') => {
  toastMessage.value = message
  toastType.value = type
  toastVisible.value = true
}

// ---- Filtered apps ----
const appsFiltradas = computed(() => {
  const term = busqueda.value.toLowerCase().trim()
  if (!term) return appStore.applications
  return appStore.applications.filter((a) => a.name.toLowerCase().includes(term))
})

// ---- Selected folder entity ----
const selectedFolder = computed(() => {
  if (!appStore.selectedFolderId || !appStore.selectedAppId) return null
  const folders = appStore.foldersMap[appStore.selectedAppId]
  if (!folders) return null
  return folders.find((f) => f.id === appStore.selectedFolderId) || null
})

// ---- Load ----
onMounted(async () => {
  try {
    await appStore.loadApplications()
  } catch {
    showToast('Error al cargar aplicaciones.', 'error')
  }
  userStore.loadSelects()
  window.addEventListener('keydown', onEsc)
  window.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
  window.removeEventListener('click', closeContextMenu)
})

const onEsc = (e) => {
  if (e.key === 'Escape') {
    if (contextMenu.value.visible) closeContextMenu()
    else if (confirmandoEliminar.value) cancelarEliminar()
    else if (mostrarCrearApp.value) mostrarCrearApp.value = false
    else if (mostrarCrearFolder.value) mostrarCrearFolder.value = false
    else if (mostrarSpecialists.value) mostrarSpecialists.value = false
    else if (colorPickerAppId.value) colorPickerAppId.value = null
  }
}

// ---- App expand/collapse ----
async function toggleApp(appId) {
  const wasExpanded = appStore.expandedAppIds.has(appId)
  appStore.toggleExpandApp(appId)
  if (!wasExpanded) {
    try {
      await appStore.selectApp(appId)
    } catch {
      showToast('Error al cargar carpetas.', 'error')
    }
  }
}

// ---- Create app ----
async function handleCreateApp(name) {
  creandoApp.value = true
  errorCrearApp.value = ''
  try {
    const newApp = await appStore.createApplication(name)
    mostrarCrearApp.value = false
    userStore.invalidateApplications()
    showToast(`Aplicación "${newApp.name}" creada.`)
    // Expand and select the new app
    appStore.expandedAppIds.add(newApp.id)
    await appStore.selectApp(newApp.id)
  } catch (e) {
    errorCrearApp.value = e.userMessage || 'Error al crear la aplicación.'
  } finally {
    creandoApp.value = false
  }
}

// ---- Context menu ----
function openContextMenu(event, type, node) {
  const items = getContextMenuItems(type, node)
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    items,
    node,
    type,
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function getContextMenuItems(type, node) {
  if (type === 'app') {
    return [
      { label: 'Renombrar', icon: 'bx-edit-alt', action: 'rename' },
      { label: 'Cambiar color', icon: 'bx-palette', action: 'change-color' },
      { label: 'Gestionar especialistas', icon: 'bx-group', action: 'manage-specialists' },
      { label: 'Nueva carpeta', icon: 'bx-folder-plus', action: 'add-folder' },
      { label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true },
    ]
  }
  if (type === 'folder') {
    const folderType = node.type
    if (folderType === 'main_box') {
      return [
        { label: 'Renombrar', icon: 'bx-edit-alt', action: 'rename' },
        { label: 'Nuevo nivel', icon: 'bx-folder-plus', action: 'add-child' },
        { label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true },
      ]
    }
    if (folderType === 'level') {
      return [
        { label: 'Renombrar', icon: 'bx-edit-alt', action: 'rename' },
        { label: 'Nuevo especialista', icon: 'bx-user-plus', action: 'add-child' },
        { label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true },
      ]
    }
    if (folderType === 'specialist') {
      return [
        { label: 'Renombrar', icon: 'bx-edit-alt', action: 'rename' },
        { label: 'Nueva subcarpeta', icon: 'bx-folder-plus', action: 'add-child' },
        { label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true },
      ]
    }
    // subfolder of specialist
    return [
      { label: 'Renombrar', icon: 'bx-edit-alt', action: 'rename' },
      { label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true },
    ]
  }
  return []
}

function handleContextAction(action) {
  const { node, type } = contextMenu.value
  closeContextMenu()

  if (action === 'rename') {
    renamingNode.value = { node, type }
    renameValue.value = node.name
  } else if (action === 'delete') {
    confirmandoEliminar.value = node
    confirmandoEliminarTipo.value = type
  } else if (action === 'change-color') {
    colorPickerAppId.value = node.id
    colorPickerValue.value = node.color || '#2AC78F'
  } else if (action === 'manage-specialists') {
    specialistsAppId.value = node.id
    mostrarSpecialists.value = true
  } else if (action === 'add-folder') {
    // New main_box folder under app
    folderContext.value = { mode: 'new-app-folder', appId: node.id }
    mostrarCrearFolder.value = true
  } else if (action === 'add-child') {
    handleAddChild(node)
  }
}

function handleAddChild(node) {
  const appId = appStore.selectedAppId
  if (node.type === 'main_box') {
    folderContext.value = { mode: 'new-level', appId, parentId: node.id }
  } else if (node.type === 'level') {
    const specialists = appStore.specialistsMap[appId] || []
    folderContext.value = {
      mode: 'new-specialist',
      appId,
      parentId: node.id,
      availableSpecialists: specialists,
    }
  } else if (node.type === 'specialist') {
    folderContext.value = {
      mode: 'new-subfolder',
      appId,
      parentId: node.id,
      specialistId: node.specialistId,
    }
  }
  mostrarCrearFolder.value = true
}

// ---- Rename ----
async function submitRename() {
  if (!renamingNode.value || !renameValue.value.trim()) return
  const { node, type } = renamingNode.value
  const newName = renameValue.value.trim()
  try {
    if (type === 'app') {
      await appStore.updateApplication(node.id, { name: newName })
      userStore.invalidateApplications()
    } else {
      await appStore.updateFolder(appStore.selectedAppId, node.id, { name: newName })
    }
    showToast('Renombrado correctamente.')
  } catch (e) {
    showToast(e.userMessage || 'Error al renombrar.', 'error')
  } finally {
    renamingNode.value = null
    renameValue.value = ''
  }
}

function cancelRename() {
  renamingNode.value = null
  renameValue.value = ''
}

// ---- Delete ----
async function ejecutarEliminar() {
  const node = confirmandoEliminar.value
  const tipo = confirmandoEliminarTipo.value
  if (!node) return
  try {
    if (tipo === 'app') {
      await appStore.deleteApplication(node.id)
      userStore.invalidateApplications()
      showToast(`Aplicación "${node.name}" eliminada.`)
    } else {
      await appStore.deleteFolder(appStore.selectedAppId, node.id)
      showToast(`Carpeta "${node.name}" eliminada.`)
    }
  } catch (e) {
    showToast(e.userMessage || 'Error al eliminar.', 'error')
  } finally {
    confirmandoEliminar.value = null
    confirmandoEliminarTipo.value = null
  }
}

function cancelarEliminar() {
  confirmandoEliminar.value = null
  confirmandoEliminarTipo.value = null
}

// ---- Color picker ----
async function submitColor() {
  if (!colorPickerAppId.value) return
  try {
    await appStore.updateApplication(colorPickerAppId.value, {
      theme: { color: colorPickerValue.value },
    })
    showToast('Color actualizado.')
  } catch (e) {
    showToast(e.userMessage || 'Error al cambiar color.', 'error')
  } finally {
    colorPickerAppId.value = null
  }
}

// ---- Create folder ----
async function handleCreateFolder(data) {
  try {
    await appStore.createFolder(folderContext.value.appId, data)
    mostrarCrearFolder.value = false
    folderContext.value = null
    showToast('Carpeta creada.')
  } catch (e) {
    showToast(e.userMessage || 'Error al crear carpeta.', 'error')
  }
}

// ---- Folder select ----
function handleFolderSelect(node) {
  appStore.selectFolder(node.id)
}

// ---- Folder context menu from tree ----
function handleFolderContextMenu(event, node) {
  openContextMenu(event, 'folder', node)
}
</script>

<template>
  <section class="app-split">
    <!-- Left panel -->
    <aside class="app-split__left">
      <!-- Header -->
      <div class="panel-header">
        <h1 class="panel-header__title">Aplicaciones</h1>
        <button @click="mostrarCrearApp = true" class="btn-icon" title="Nueva Aplicación">
          <i class='bx bx-plus'></i>
        </button>
      </div>

      <!-- Search -->
      <div class="panel-search">
        <i class='bx bx-search panel-search__icon'></i>
        <input v-model="busqueda" type="text" class="panel-search__input" placeholder="Buscar aplicación...">
      </div>

      <!-- Loading -->
      <SectionLoader v-if="appStore.loading" message="Cargando..." />

      <!-- App list / tree -->
      <div v-else class="app-tree">
        <div v-if="appsFiltradas.length === 0" class="app-tree__empty">
          <p>{{ busqueda.trim() ? 'Sin resultados.' : 'No hay aplicaciones.' }}</p>
        </div>

        <div v-for="app in appsFiltradas" :key="app.id" class="app-node">
          <!-- App header row -->
          <div
            class="app-node__header"
            :class="{ 'app-node__header--selected': appStore.selectedAppId === app.id }"
            @click="toggleApp(app.id)"
          >
            <i
              class='bx app-node__chevron'
              :class="appStore.expandedAppIds.has(app.id) ? 'bx-chevron-down' : 'bx-chevron-right'"
            ></i>
            <span
              class="app-node__color"
              :style="{ backgroundColor: app.color || 'var(--primary-500)' }"
            ></span>
            <span class="app-node__name">{{ app.name }}</span>
            <button
              class="btn-dots"
              @click.stop="openContextMenu($event, 'app', app)"
              title="Opciones"
            >
              <i class='bx bx-dots-vertical-rounded'></i>
            </button>
          </div>

          <!-- Folder tree (lazy loaded) -->
          <div v-if="appStore.expandedAppIds.has(app.id)" class="app-node__tree">
            <div v-if="appStore.loadingFolders && !appStore.foldersMap[app.id]" class="app-node__loading">
              <i class='bx bx-loader-alt bx-spin'></i> Cargando...
            </div>
            <FolderTree
              v-else-if="appStore.foldersMap[app.id]"
              :folders="appStore.foldersMap[app.id]"
              :specialists="appStore.specialistsMap[app.id] || []"
              :support-levels="userStore.supportLevels"
              :selected-folder-id="appStore.selectedFolderId"
              :collapsed-main-box-ids="appStore.collapsedMainBoxIds"
              @select="handleFolderSelect"
              @context-menu="handleFolderContextMenu"
              @toggle-collapse="(id) => appStore.toggleMainBoxCollapse(id)"
            />
          </div>
        </div>
      </div>
    </aside>

    <!-- Right panel -->
    <main class="app-split__right">
      <ConversationPanel :selected-folder="selectedFolder" />
    </main>

    <!-- Context menu -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @select="handleContextAction"
      @close="closeContextMenu"
    />

    <!-- Rename modal -->
    <div v-if="renamingNode" class="modal-overlay" @click.self="cancelRename">
      <div class="modal-content modal-content--sm">
        <div class="modal-header">
          <h2>Renombrar</h2>
          <button @click="cancelRename" class="btn-close"><i class='bx bx-x'></i></button>
        </div>
        <div class="modal-body">
          <input
            v-model="renameValue"
            type="text"
            class="input-field"
            placeholder="Nuevo nombre"
            @keyup.enter="submitRename"
            ref="renameInput"
          >
        </div>
        <div class="modal-actions">
          <button @click="cancelRename" class="btn-secondary">Cancelar</button>
          <button @click="submitRename" class="btn-primary" :disabled="!renameValue.trim()">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div v-if="confirmandoEliminar" class="modal-overlay" @click.self="cancelarEliminar">
      <div class="modal-content modal-content--sm">
        <div class="modal-header">
          <h2>Eliminar {{ confirmandoEliminarTipo === 'app' ? 'Aplicación' : 'Carpeta' }}</h2>
          <button @click="cancelarEliminar" class="btn-close"><i class='bx bx-x'></i></button>
        </div>
        <div class="confirm-body">
          <div class="confirm-icon"><i class='bx bx-error-circle'></i></div>
          <p>¿Eliminar <strong>{{ confirmandoEliminar.name }}</strong>?</p>
          <p v-if="confirmandoEliminarTipo === 'app'" class="confirm-hint">
            Se eliminarán todas las carpetas y asignaciones.
          </p>
        </div>
        <div class="modal-actions">
          <button @click="cancelarEliminar" class="btn-secondary">Cancelar</button>
          <button @click="ejecutarEliminar" class="btn-danger">
            <i class='bx bx-trash'></i> Eliminar
          </button>
        </div>
      </div>
    </div>

    <!-- Color picker modal -->
    <div v-if="colorPickerAppId" class="modal-overlay" @click.self="colorPickerAppId = null">
      <div class="modal-content modal-content--sm">
        <div class="modal-header">
          <h2>Color de la aplicación</h2>
          <button @click="colorPickerAppId = null" class="btn-close"><i class='bx bx-x'></i></button>
        </div>
        <div class="modal-body" style="display:flex;align-items:center;gap:1rem;">
          <input type="color" v-model="colorPickerValue" class="color-input">
          <span class="color-preview" :style="{ color: colorPickerValue }">{{ colorPickerValue }}</span>
        </div>
        <div class="modal-actions">
          <button @click="colorPickerAppId = null" class="btn-secondary">Cancelar</button>
          <button @click="submitColor" class="btn-primary">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Create application modal -->
    <CreateApplicationModal
      :visible="mostrarCrearApp"
      :creating="creandoApp"
      :error="errorCrearApp"
      @close="mostrarCrearApp = false; errorCrearApp = ''"
      @create="handleCreateApp"
    />

    <!-- Create folder modal -->
    <CreateFolderModal
      v-if="mostrarCrearFolder"
      :visible="mostrarCrearFolder"
      :context="folderContext"
      :support-levels="userStore.supportLevels"
      @close="mostrarCrearFolder = false; folderContext = null"
      @create="handleCreateFolder"
    />

    <!-- Manage specialists modal -->
    <ManageSpecialistsModal
      v-if="mostrarSpecialists"
      :visible="mostrarSpecialists"
      :app-id="specialistsAppId"
      :specialists="appStore.specialistsMap[specialistsAppId] || []"
      @close="mostrarSpecialists = false; specialistsAppId = null"
      @assign="(user) => appStore.assignSpecialist(specialistsAppId, user)"
      @remove="(userId) => appStore.removeSpecialist(specialistsAppId, userId)"
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
.app-split {
  display: flex;
  height: 100%;
  gap: 0;
}

.app-split__left {
  width: 320px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--bg-main);
  border-right: 1px solid var(--border-light);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  overflow: hidden;
}

.app-split__right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  overflow: hidden;
  position: relative;
}

/* ---- Panel header ---- */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.5rem;
}

.panel-header__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary-500);
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-icon:hover { background: var(--primary-600); }

/* ---- Search ---- */
.panel-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.5rem 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.panel-search__icon { color: var(--text-secondary); font-size: 1rem; }

.panel-search__input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.85rem;
  color: var(--text-primary);
  background: transparent;
}

/* ---- App tree ---- */
.app-tree {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.app-tree__empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

/* ---- App node ---- */
.app-node {
  border-bottom: 1px solid var(--border-light);
}

.app-node:last-child { border-bottom: none; }

.app-node__header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.app-node__header:hover { background: var(--bg-card); }

.app-node__header--selected {
  background: rgba(42, 199, 143, 0.08);
}

.app-node__chevron {
  font-size: 1rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.app-node__color {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.app-node__name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.app-node__header:hover .btn-dots { opacity: 1; }
.btn-dots:hover { background: var(--border-light); color: var(--text-primary); }

.app-node__tree {
  padding-left: 0.5rem;
}

.app-node__loading {
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* ---- Modals ---- */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
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

.modal-body { padding: 0.5rem 0; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.input-field {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  color: var(--text-primary);
  outline: none;
}

.input-field:focus { border-color: var(--primary-500); }

.confirm-body { text-align: center; padding: 0.5rem 0; }
.confirm-icon { font-size: 2.5rem; color: var(--error-500); margin-bottom: 0.75rem; }
.confirm-body p { font-size: 0.9rem; color: var(--text-primary); line-height: 1.4; }
.confirm-hint { font-size: 0.8rem !important; color: var(--text-secondary) !important; margin-top: 0.4rem; }

.btn-primary {
  padding: 0.55rem 1rem;
  background: var(--primary-500);
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--primary-600); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.55rem 1rem;
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

.color-input {
  width: 48px;
  height: 48px;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.color-preview {
  font-size: 0.9rem;
  font-weight: 600;
  font-family: monospace;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .app-split {
    flex-direction: column;
  }

  .app-split__left {
    width: 100%;
    min-width: 0;
    border-right: none;
    border-radius: var(--radius-lg);
  }

  .app-split__right { display: none; }

  .panel-header { padding: 0.75rem 0.75rem 0.4rem; }
  .panel-search { margin: 0.4rem 0.75rem; padding: 0.4rem 0.6rem; }
  .app-node__header { padding: 0.5rem 0.75rem; }
  .app-node__tree { padding-left: 0.25rem; }
}
</style>

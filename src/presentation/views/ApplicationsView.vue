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

// ---- Layout ----
const layout = computed(() => appStore.viewLayout)
const showRightPanel = computed(() => layout.value !== 'tree-only')

// ---- Collapsible sidebar ----
const sidebarCollapsed = ref(localStorage.getItem('tyflow_app_sidebar_collapsed') === 'true')

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('tyflow_app_sidebar_collapsed', String(sidebarCollapsed.value))
}

// ---- Resizable sidebar ----
const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 420
const SIDEBAR_DEFAULT = 280
const sidebarWidth = ref(parseInt(localStorage.getItem('tyflow_app_sidebar_width')) || SIDEBAR_DEFAULT)

function onSidebarResizeStart(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = sidebarWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMove = (ev) => {
    const w = startW + (ev.clientX - startX)
    sidebarWidth.value = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w))
  }

  const onUp = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    localStorage.setItem('tyflow_app_sidebar_width', String(sidebarWidth.value))
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onSidebarResizeDblClick() {
  sidebarWidth.value = SIDEBAR_DEFAULT
  localStorage.setItem('tyflow_app_sidebar_width', String(SIDEBAR_DEFAULT))
}

// ---- Mobile navigation (Outlook-style) ----
const isMobile = ref(window.innerWidth < 768)
const mobileShowConversations = ref(false)

function onResize() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) mobileShowConversations.value = false
}

function mobileBack() {
  mobileShowConversations.value = false
}

// When folder is selected on mobile, switch to conversations view
watch(() => appStore.selectedFolderId, (id) => {
  if (id && isMobile.value) {
    mobileShowConversations.value = true
  }
})

// ---- Selected folder name for mobile back header ----
const selectedFolderName = computed(() => selectedFolder.value?.name || 'Conversaciones')

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
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
  window.removeEventListener('click', closeContextMenu)
  window.removeEventListener('resize', onResize)
})

const onEsc = (e) => {
  if (e.key === 'Escape') {
    if (isMobile.value && mobileShowConversations.value) mobileBack()
    else if (contextMenu.value.visible) closeContextMenu()
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
  if (isMobile.value) mobileShowConversations.value = true
}

// ---- Folder context menu from tree ----
function handleFolderContextMenu(event, node) {
  openContextMenu(event, 'folder', node)
}
</script>

<template>
  <section class="app-shell">
    <!-- Toolbar -->
    <div class="app-toolbar">
      <div class="app-toolbar__left">
        <button
          class="app-toolbar__btn"
          :class="{ 'app-toolbar__btn--active': layout === 'split-h' }"
          @click="appStore.setViewLayout('split-h')"
          title="Vista horizontal"
        >
          <i class='bx bx-dock-right'></i>
        </button>
        <button
          class="app-toolbar__btn"
          :class="{ 'app-toolbar__btn--active': layout === 'tree-only' }"
          @click="appStore.setViewLayout('tree-only')"
          title="Solo árbol"
        >
          <i class='bx bx-list-ul'></i>
        </button>
      </div>
      <div class="app-toolbar__right">
        <span v-if="selectedFolder" class="app-toolbar__breadcrumb">
          <i class='bx bx-folder'></i> {{ selectedFolder.name }}
        </span>
      </div>
    </div>

    <!-- Split container -->
    <div
      class="app-split"
      :class="{
        'app-split--h': layout === 'split-h',
        'app-split--tree': layout === 'tree-only',
      }"
    >
      <!-- Left panel -->
      <aside
        v-show="!isMobile || !mobileShowConversations"
        class="app-split__left"
        :class="{ 'app-split__left--collapsed': sidebarCollapsed && !isMobile }"
        :style="!sidebarCollapsed && !isMobile ? { width: sidebarWidth + 'px' } : {}"
      >
        <!-- Header -->
        <div class="panel-header">
          <h1 v-if="!sidebarCollapsed || isMobile" class="panel-header__title">Aplicaciones</h1>
          <div class="panel-header__actions">
            <button v-if="!sidebarCollapsed || isMobile" @click="mostrarCrearApp = true" class="btn-icon" title="Nueva Aplicación">
              <i class='bx bx-plus'></i>
            </button>
            <button v-if="!isMobile" @click="toggleSidebar" class="btn-icon-ghost" :title="sidebarCollapsed ? 'Expandir panel' : 'Colapsar panel'">
              <i class='bx' :class="sidebarCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'"></i>
            </button>
          </div>
        </div>

        <!-- Search -->
        <div v-if="!sidebarCollapsed || isMobile" class="panel-search">
          <i class='bx bx-search panel-search__icon'></i>
          <input v-model="busqueda" type="text" class="panel-search__input" placeholder="Buscar aplicación...">
        </div>

        <!-- Loading -->
        <SectionLoader v-if="(!sidebarCollapsed || isMobile) && appStore.loading" message="Cargando..." />

        <!-- Collapsed: icon-only app list -->
        <div v-if="sidebarCollapsed && !isMobile" class="app-tree app-tree--collapsed">
          <div
            v-for="app in appsFiltradas"
            :key="app.id"
            class="app-collapsed-item"
            :title="app.name"
            @click="toggleApp(app.id)"
          >
            <span class="app-node__color" :style="{ backgroundColor: app.color || 'var(--primary-500)' }"></span>
          </div>
        </div>

        <!-- App list / tree (expanded) -->
        <div v-else-if="!appStore.loading" class="app-tree">
          <div v-if="appsFiltradas.length === 0" class="app-tree__empty">
            <p>{{ busqueda.trim() ? 'Sin resultados.' : 'No hay aplicaciones.' }}</p>
          </div>

          <div v-for="app in appsFiltradas" :key="app.id" class="app-node">
            <!-- App header row -->
            <div
              class="app-node__header"
              :class="{
                'app-node__header--selected': appStore.selectedAppId === app.id,
                'app-node__header--expanded': appStore.expandedAppIds.has(app.id),
              }"
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

      <!-- Resize handle -->
      <div
        v-if="!isMobile && !sidebarCollapsed && showRightPanel"
        class="app-resize-handle"
        @mousedown="onSidebarResizeStart"
        @dblclick="onSidebarResizeDblClick"
      ></div>

      <!-- Right panel -->
      <main v-if="showRightPanel || (isMobile && mobileShowConversations)" v-show="!isMobile || mobileShowConversations" class="app-split__right">
        <!-- Mobile back header -->
        <div v-if="isMobile" class="app-mobile-back">
          <button class="app-mobile-back__btn" @click="mobileBack">
            <i class='bx bx-arrow-back'></i>
          </button>
          <span class="app-mobile-back__title">{{ selectedFolderName }}</span>
        </div>
        <ConversationPanel :selected-folder="selectedFolder" :split-view="!isMobile" />
      </main>
    </div>

    <!-- Mobile bottom tab bar -->
    <nav v-if="isMobile" class="app-mobile-tabs">
      <button
        class="app-mobile-tabs__btn"
        :class="{ 'app-mobile-tabs__btn--active': !mobileShowConversations }"
        @click="mobileShowConversations = false"
      >
        <i class='bx bx-folder-open'></i>
        <span>Árbol</span>
      </button>
      <button
        class="app-mobile-tabs__btn"
        :class="{ 'app-mobile-tabs__btn--active': mobileShowConversations }"
        @click="mobileShowConversations = true"
      >
        <i class='bx bx-envelope'></i>
        <span>Conversaciones</span>
      </button>
    </nav>

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
        <div class="modal-body" style="display:flex;align-items:center;gap:0.75rem;">
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
/* ===== Shell (full height container) ===== */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-main);
}

/* ===== Toolbar ===== */
.app-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 0.5rem;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.app-toolbar__left {
  display: flex;
  align-items: center;
  gap: 2px;
}

.app-toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.1s;
}

.app-toolbar__btn:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.app-toolbar__btn--active {
  background: rgba(42, 199, 143, 0.12);
  color: var(--primary-500);
}

.app-toolbar__right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.app-toolbar__breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.app-toolbar__breadcrumb i {
  font-size: 0.82rem;
}

/* ===== Split container ===== */
.app-split {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Split horizontal (default) */
.app-split--h {
  flex-direction: row;
}


/* Tree only */
.app-split--tree {
  flex-direction: row;
}

.app-split--tree .app-split__left {
  width: 100%;
  max-width: none;
  border-right: none;
}

/* ===== Left panel ===== */
.app-split__left {
  min-width: 220px;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  background: var(--bg-main);
  overflow: hidden;
  flex-shrink: 0;
  transition: width 0.25s ease;
}

.app-split__left--collapsed {
  width: 56px !important;
  min-width: 56px !important;
  max-width: 56px !important;
}

/* ===== Resize handle ===== */
.app-resize-handle {
  width: 6px;
  margin-left: -3px;
  margin-right: -3px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 5;
  background: transparent;
  transition: background 0.15s;
  border-left: 1px solid var(--border-light);
}

.app-resize-handle:hover,
.app-resize-handle:active {
  background: rgba(42, 199, 143, 0.4);
}

/* ===== Right panel ===== */
.app-split__right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  overflow: hidden;
  position: relative;
  min-width: 0;
}

/* ---- Panel header ---- */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.5rem 0.3rem;
}

.panel-header__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-header__actions {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-shrink: 0;
}

.btn-icon-ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-icon-ghost:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

/* ---- Collapsed sidebar items ---- */
.app-tree--collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.app-collapsed-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s;
}

.app-collapsed-item:hover { background: var(--bg-card); }

.app-collapsed-item .app-node__color {
  width: 12px;
  height: 12px;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary-500);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-icon:hover { background: var(--primary-600); }

/* ---- Search ---- */
.panel-search {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.2rem 0.5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.panel-search__icon { color: var(--text-secondary); font-size: 0.9rem; }

.panel-search__input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.8rem;
  color: var(--text-primary);
  background: transparent;
}

/* ---- App tree ---- */
.app-tree {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.app-tree__empty {
  text-align: center;
  padding: 1.5rem 0.75rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

/* ---- App node ---- */
.app-node + .app-node {
  border-top: 1px solid var(--border-light);
}

.app-node__header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.app-node__header:hover { background: var(--bg-card); }

.app-node__header--selected {
  background: rgba(42, 199, 143, 0.06);
}

.app-node__header--expanded {
  border-bottom: 1px solid var(--border-light);
}

.app-node__chevron {
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex-shrink: 0;
  width: 14px;
}

.app-node__color {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.app-node__name {
  flex: 1;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
  font-size: 0.9rem;
}

.app-node__header:hover .btn-dots { opacity: 1; }
.btn-dots:hover { background: var(--border-light); color: var(--text-primary); }

.app-node__tree {
  padding-left: 0.75rem;
  padding-bottom: 0.15rem;
}

.app-node__loading {
  padding: 0.3rem 0.75rem;
  font-size: 0.75rem;
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
  padding: 1.25rem;
  box-shadow: var(--shadow-lg);
}

.modal-content--sm { max-width: 380px; width: 100%; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.65rem;
}

.modal-header h2 { font-size: 1rem; font-weight: 700; color: var(--text-primary); }

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.3rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-body { padding: 0.25rem 0; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.input-field {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-primary);
  outline: none;
}

.input-field:focus { border-color: var(--primary-500); }

.confirm-body { text-align: center; padding: 0.35rem 0; }
.confirm-icon { font-size: 2rem; color: var(--error-500); margin-bottom: 0.5rem; }
.confirm-body p { font-size: 0.85rem; color: var(--text-primary); line-height: 1.4; }
.confirm-hint { font-size: 0.75rem !important; color: var(--text-secondary) !important; margin-top: 0.3rem; }

.btn-primary {
  padding: 0.4rem 0.85rem;
  background: var(--primary-500);
  color: white;
  font-weight: 600;
  font-size: 0.82rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--primary-600); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.4rem 0.85rem;
  font-size: 0.82rem;
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
  gap: 0.25rem;
  padding: 0.4rem 0.85rem;
  background: var(--error-500);
  color: white;
  font-weight: 600;
  font-size: 0.82rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}
.btn-danger:hover { background: #DC2626; }

.color-input {
  width: 40px;
  height: 40px;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.color-preview {
  font-size: 0.85rem;
  font-weight: 600;
  font-family: monospace;
}

/* ---- Responsive ---- */

/* ── Mobile back header ── */
.app-mobile-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-main);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}

.app-mobile-back__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  transition: background 0.15s;
}

.app-mobile-back__btn:hover {
  background: var(--bg-card);
}

.app-mobile-back__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Bottom tab bar ── */
.app-mobile-tabs {
  display: flex;
  border-top: 1px solid var(--border-light);
  background: var(--bg-main);
  flex-shrink: 0;
}

.app-mobile-tabs__btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  gap: 0.2rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.65rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s;
  min-height: 52px;
}

.app-mobile-tabs__btn i {
  font-size: 1.25rem;
}

.app-mobile-tabs__btn--active {
  color: var(--primary-500);
}

/* Mobile: full-screen panels (Outlook-style navigation) */
@media (max-width: 767px) {
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .app-toolbar__left { gap: 4px; }

  .app-split__left {
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    max-height: none !important;
    border-right: none !important;
    flex: 1;
  }

  .app-split__right {
    flex: 1;
    align-items: stretch;
    flex-direction: column;
  }

  .panel-header { padding: 0.35rem 0.4rem 0.25rem; }
  .panel-search { margin: 0.15rem 0.4rem; padding: 0.25rem 0.4rem; }
  .app-node__header { padding: 0.3rem 0.4rem; }
  .app-node__tree { padding-left: 0.75rem; }
}

@media (max-width: 480px) {
  .app-toolbar { padding: 0 0.35rem; }
  .panel-header__title { font-size: 0.8rem; }
}
</style>

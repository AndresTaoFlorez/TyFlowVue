<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchApplicationsUseCase } from '@/application/use-cases/applications/FetchApplicationsUseCase'
import { createApplicationUseCase } from '@/application/use-cases/applications/CreateApplicationUseCase'
import { deleteApplicationUseCase } from '@/application/use-cases/applications/DeleteApplicationUseCase'
import { fetchAppSpecialistsUseCase } from '@/application/use-cases/applications/FetchAppSpecialistsUseCase'
import { updateUserUseCase } from '@/application/use-cases/users/UpdateUserUseCase'
import { useUserStore } from '@/presentation/stores/useUserStore'
import ApplicationCard from '@/presentation/components/ApplicationCard.vue'
import ApplicationDetail from '@/presentation/components/ApplicationDetail.vue'
import CreateApplicationModal from '@/presentation/components/CreateApplicationModal.vue'
import SectionLoader from '@/presentation/components/SectionLoader.vue'
import ToastNotification from '@/presentation/components/ToastNotification.vue'
import logger from '@/infrastructure/logger'

const userStore = useUserStore()

const applications = ref([])
const loading = ref(false)
const selectedApp = ref(null)
const specialists = ref([])
const loadingSpecialists = ref(false)
const assigning = ref(false)
const specialistCounts = ref({})
const mostrarCrear = ref(false)
const creando = ref(false)
const errorCrear = ref('')
const busqueda = ref('')
const confirmandoEliminar = ref(null)

const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const showToast = (message, type = 'success') => {
  toastMessage.value = message
  toastType.value = type
  toastVisible.value = true
}

// ---- Load apps ----
const loadApplications = async () => {
  loading.value = true
  try {
    applications.value = await fetchApplicationsUseCase()
    // Load specialist counts for all apps
    const counts = {}
    await Promise.all(applications.value.map(async (app) => {
      try {
        const specs = await fetchAppSpecialistsUseCase(app.id)
        counts[app.id] = specs.length
      } catch {
        counts[app.id] = 0
      }
    }))
    specialistCounts.value = counts
  } catch (e) {
    logger.error('[Apps] Error cargando aplicaciones:', e)
    showToast('Error al cargar aplicaciones.', 'error')
  } finally {
    loading.value = false
  }
}

// ---- Select app ----
const selectApp = async (app) => {
  if (selectedApp.value?.id === app.id) return
  selectedApp.value = app
  loadingSpecialists.value = true
  try {
    specialists.value = await fetchAppSpecialistsUseCase(app.id)
  } catch (e) {
    logger.error('[Apps] Error cargando especialistas:', e)
    specialists.value = []
  } finally {
    loadingSpecialists.value = false
  }
}

const closeDetail = () => {
  selectedApp.value = null
  specialists.value = []
}

// ---- Create app ----
const handleCreate = async (name) => {
  creando.value = true
  errorCrear.value = ''
  try {
    const newApp = await createApplicationUseCase(name)
    applications.value.push(newApp)
    specialistCounts.value[newApp.id] = 0
    mostrarCrear.value = false
    userStore.invalidateApplications()
    showToast(`Aplicación "${newApp.name}" creada.`)
  } catch (e) {
    logger.error('[Apps] Error creando aplicación:', e)
    errorCrear.value = e.userMessage || 'Error al crear la aplicación.'
  } finally {
    creando.value = false
  }
}

// ---- Delete app ----
const confirmarEliminar = (app) => {
  confirmandoEliminar.value = app
}

const cancelarEliminar = () => {
  confirmandoEliminar.value = null
}

const ejecutarEliminar = async () => {
  const app = confirmandoEliminar.value
  if (!app) return
  try {
    await deleteApplicationUseCase(app.id)
    applications.value = applications.value.filter(a => a.id !== app.id)
    delete specialistCounts.value[app.id]
    if (selectedApp.value?.id === app.id) closeDetail()
    userStore.invalidateApplications()
    showToast(`Aplicación "${app.name}" eliminada.`)
  } catch (e) {
    logger.error('[Apps] Error eliminando aplicación:', e)
    showToast(e.userMessage || 'Error al eliminar la aplicación.', 'error')
  } finally {
    confirmandoEliminar.value = null
  }
}

// ---- Assign specialist to app ----
const handleAssign = async (user) => {
  assigning.value = true
  try {
    const currentAppIds = user.applicationAssignments.map(a => a.application_id)
    const newAppIds = [...currentAppIds, selectedApp.value.id]
    await updateUserUseCase(user.id, {
      firstName: user.firstName,
      secondName: user.secondName,
      firstSurname: user.firstSurname,
      secondSurname: user.secondSurname,
      documentNumber: user.documentNumber,
      applicationIds: newAppIds,
    })
    specialists.value.push(user)
    specialistCounts.value[selectedApp.value.id] = (specialistCounts.value[selectedApp.value.id] || 0) + 1
    // Actualizar applicationAssignments del usuario en el store
    await userStore.loadUsers()
    showToast(`${user.fullName} asignado correctamente.`)
  } catch (e) {
    logger.error('[Apps] Error asignando especialista:', e)
    showToast(e.userMessage || 'Error al asignar especialista.', 'error')
  } finally {
    assigning.value = false
  }
}

// ---- Remove specialist from app ----
const handleRemove = async (user) => {
  try {
    const currentAppIds = user.applicationAssignments.map(a => a.application_id)
    const newAppIds = currentAppIds.filter(id => id !== selectedApp.value.id)
    await updateUserUseCase(user.id, {
      firstName: user.firstName,
      secondName: user.secondName,
      firstSurname: user.firstSurname,
      secondSurname: user.secondSurname,
      documentNumber: user.documentNumber,
      applicationIds: newAppIds,
    })
    specialists.value = specialists.value.filter(s => s.id !== user.id)
    specialistCounts.value[selectedApp.value.id] = Math.max(0, (specialistCounts.value[selectedApp.value.id] || 1) - 1)
    await userStore.loadUsers()
    showToast('Especialista removido de la aplicación.')
  } catch (e) {
    logger.error('[Apps] Error removiendo especialista:', e)
    showToast(e.userMessage || 'Error al remover especialista.', 'error')
  }
}

// ---- Filtered apps ----
const appsFiltradas = computed(() => {
  const term = busqueda.value.toLowerCase().trim()
  if (!term) return applications.value
  return applications.value.filter(a => a.name.toLowerCase().includes(term))
})

// ---- ESC to close ----
const onEsc = (e) => {
  if (e.key === 'Escape') {
    if (confirmandoEliminar.value) cancelarEliminar()
    else if (mostrarCrear.value) mostrarCrear.value = false
    else if (selectedApp.value) closeDetail()
  }
}

onMounted(() => {
  loadApplications()
  userStore.loadUsers()
  window.addEventListener('keydown', onEsc)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <section class="content">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-header__title">Aplicaciones</h1>
      <button @click="mostrarCrear = true" class="btn-create">
        <i class='bx bx-plus'></i>
        <span class="btn-create__label">Nueva Aplicación</span>
        <span class="btn-create__short">Nueva</span>
      </button>
    </div>

    <!-- Search bar -->
    <div class="filter-bar">
      <div class="filter-bar__group">
        <i class='bx bx-search filter-bar__icon'></i>
        <input v-model="busqueda" type="text" class="filter-bar__input" placeholder="Buscar aplicación...">
      </div>
      <div class="filter-bar__count">
        {{ appsFiltradas.length }} aplicación{{ appsFiltradas.length !== 1 ? 'es' : '' }}
      </div>
    </div>

    <!-- Loading -->
    <SectionLoader v-if="loading" message="Cargando aplicaciones..." />

    <!-- Main layout: list + detail -->
    <div v-else class="apps-layout">
      <!-- App list -->
      <div class="apps-list">
        <div v-if="appsFiltradas.length === 0" class="apps-empty">
          <i class='bx bx-cube'></i>
          <p>{{ busqueda.trim() ? 'No se encontraron aplicaciones.' : 'No hay aplicaciones registradas.' }}</p>
        </div>

        <ApplicationCard
          v-for="app in appsFiltradas"
          :key="app.id"
          :application="app"
          :selected="selectedApp?.id === app.id"
          :specialist-count="specialistCounts[app.id] ?? null"
          @select="selectApp"
          @delete="confirmarEliminar"
        />
      </div>

      <!-- Detail panel -->
      <div v-if="selectedApp" class="apps-detail">
        <ApplicationDetail
          :application="selectedApp"
          :specialists="specialists"
          :all-users="userStore.users"
          :loading="loadingSpecialists"
          :assigning="assigning"
          @assign="handleAssign"
          @remove="handleRemove"
          @close="closeDetail"
        />
      </div>

      <!-- Placeholder when nothing selected -->
      <div v-else class="apps-detail apps-detail--placeholder">
        <div class="placeholder">
          <i class='bx bx-pointer'></i>
          <p>Selecciona una aplicación para ver sus detalles</p>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div v-if="confirmandoEliminar" class="modal-overlay" @click.self="cancelarEliminar">
      <div class="modal-content modal-content--sm">
        <div class="modal-header">
          <h2>Eliminar Aplicación</h2>
          <button @click="cancelarEliminar" class="btn-close"><i class='bx bx-x'></i></button>
        </div>
        <div class="confirm-body">
          <div class="confirm-icon">
            <i class='bx bx-error-circle'></i>
          </div>
          <p>¿Estás seguro de que deseas eliminar <strong>{{ confirmandoEliminar.name }}</strong>?</p>
          <p class="confirm-hint">Esta acción eliminará todas las asignaciones de especialistas.</p>
        </div>
        <div class="modal-actions">
          <button @click="cancelarEliminar" class="btn-secondary">Cancelar</button>
          <button @click="ejecutarEliminar" class="btn-danger">
            <i class='bx bx-trash'></i> Eliminar
          </button>
        </div>
      </div>
    </div>

    <!-- Create modal -->
    <CreateApplicationModal
      :visible="mostrarCrear"
      :creating="creando"
      :error="errorCrear"
      @close="mostrarCrear = false; errorCrear = ''"
      @create="handleCreate"
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
  gap: 1.5rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-create {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem 0.8rem;
  background-color: var(--primary-500);
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 1px 3px rgba(42, 199, 143, 0.3);
}

.btn-create:hover {
  background-color: var(--primary-600);
  box-shadow: 0 3px 8px rgba(42, 199, 143, 0.35);
}

.btn-create:active {
  transform: scale(0.97);
}

.btn-create i {
  font-size: 1.2rem;
}

.btn-create__short {
  display: none;
}

.filter-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
  background: white;
  padding: 1rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.filter-bar__group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-light);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-sm);
  flex: 1;
  background-color: var(--bg-main);
}

.filter-bar__icon {
  color: var(--text-secondary);
  font-size: 1.2rem;
}

.filter-bar__input {
  border: none;
  outline: none;
  width: 100%;
  color: var(--text-primary);
  background: transparent;
}

.filter-bar__count {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ---- Layout ---- */
.apps-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

.apps-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.apps-detail {
  position: sticky;
  top: 1rem;
}

.apps-detail--placeholder {
  background: white;
  border: 1.5px dashed var(--border-light);
  border-radius: var(--radius-lg);
  min-height: 20rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  text-align: center;
  color: var(--text-secondary);
  opacity: 0.5;
}

.placeholder i {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.placeholder p {
  font-size: 0.9rem;
}

.apps-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.apps-empty i {
  font-size: 2.5rem;
  opacity: 0.3;
}

.apps-empty p {
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

/* ---- Delete modal ---- */
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

.modal-content--sm {
  max-width: 400px;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.confirm-body {
  text-align: center;
  padding: 0.5rem 0;
}

.confirm-icon {
  font-size: 2.5rem;
  color: var(--error-500);
  margin-bottom: 0.75rem;
}

.confirm-body p {
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.4;
}

.confirm-hint {
  font-size: 0.8rem !important;
  color: var(--text-secondary) !important;
  margin-top: 0.4rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
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

.btn-danger:hover {
  background: #DC2626;
}

@media (max-width: 900px) {
  .apps-layout {
    grid-template-columns: 1fr;
  }
  .apps-detail {
    position: static;
  }
}

@media (max-width: 768px) {
  .btn-create__label { display: none; }
  .btn-create__short { display: inline; }
}
</style>

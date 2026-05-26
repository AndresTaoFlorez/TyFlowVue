<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { fetchWorkWindowsUseCase } from '@/application/use-cases/work-windows/FetchWorkWindowsUseCase'
import { createWorkWindowUseCase } from '@/application/use-cases/work-windows/CreateWorkWindowUseCase'
import { openWorkWindowUseCase } from '@/application/use-cases/work-windows/OpenWorkWindowUseCase'
import { closeWorkWindowUseCase } from '@/application/use-cases/work-windows/CloseWorkWindowUseCase'
import { deleteWorkWindowUseCase } from '@/application/use-cases/work-windows/DeleteWorkWindowUseCase'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import WeekCalendar from '@/presentation/components/WeekCalendar.vue'
import WorkWindowModal from '@/presentation/components/WorkWindowModal.vue'
import CreateWorkWindowModal from '@/presentation/components/CreateWorkWindowModal.vue'
import SectionLoader from '@/presentation/components/SectionLoader.vue'
import ToastNotification from '@/presentation/components/ToastNotification.vue'
import logger from '@/infrastructure/logger'

const authStore = useAuthStore()
const userStore = useUserStore()

const windows = ref([])
const loading = ref(false)
const selectedWindow = ref(null)
const mostrarCrear = ref(false)
const creando = ref(false)
const errorCrear = ref('')
const prefillData = ref(null)
const weekOffset = ref(0)

// Filtros
const filtroSpecialist = ref('all')
const filtroApp = ref('all')

// Toast
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')
const showToast = (msg, type = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
}

// ---- Specialists que tienen ventanas o son del store ----
const specialistsConVentana = computed(() => {
  return userStore.users.filter(u => u.specialistId)
})

// ---- Semana ----
const weekDates = computed(() => {
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff + weekOffset.value * 7)
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
})

const weekLabel = computed(() => {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const first = weekDates.value[0].split('-')
  const last = weekDates.value[6].split('-')
  return `${parseInt(first[2])} – ${parseInt(last[2])} ${meses[parseInt(last[1]) - 1]} ${last[0]}`
})

// ---- Filtrar ventanas ----
const windowsFiltradas = computed(() => {
  return windows.value.filter(w => {
    if (filtroSpecialist.value !== 'all' && w.specialistId !== filtroSpecialist.value) return false
    if (filtroApp.value !== 'all' && w.applicationId !== filtroApp.value) return false
    return true
  })
})

// ---- Opciones de filtro ----
const specOptions = computed(() => {
  const ids = new Set(windows.value.map(w => w.specialistId))
  return specialistsConVentana.value.filter(u => ids.has(u.specialistId))
})

const appOptions = computed(() => {
  const ids = new Set(windows.value.map(w => w.applicationId))
  return userStore.applications.filter(a => ids.has(a.id))
})

// ---- Cargar ventanas (solo loader en carga inicial) ----
const loadWindows = async () => {
  const isFirstLoad = windows.value.length === 0
  if (isFirstLoad) loading.value = true
  try {
    windows.value = await fetchWorkWindowsUseCase({
      date_from: weekDates.value[0],
      date_to: weekDates.value[6],
    })
  } catch (e) {
    logger.error('[Calendario] Error cargando ventanas:', e)
    showToast('Error al cargar ventanas de trabajo.', 'error')
  } finally {
    loading.value = false
  }
}

// ---- Seleccion en calendario ----
const onRangeSelected = (range) => {
  prefillData.value = range
  mostrarCrear.value = true
}

const openCreatePanel = () => {
  prefillData.value = null
  mostrarCrear.value = true
}

// ---- Crear ventana (optimista) ----
const handleCreate = async (data) => {
  creando.value = true
  errorCrear.value = ''
  try {
    const created = await createWorkWindowUseCase(data)
    windows.value = [...windows.value, ...created]
    mostrarCrear.value = false
    prefillData.value = null
    showToast('Ventana de trabajo creada.')
  } catch (e) {
    logger.error('[Calendario] Error creando ventana:', e)
    errorCrear.value = e.userMessage || 'Error al crear la ventana.'
  } finally {
    creando.value = false
  }
}

// ---- Abrir sesion (optimista) ----
const handleOpen = async (w) => {
  try {
    await openWorkWindowUseCase(w.id)
    const idx = windows.value.findIndex(x => x.id === w.id)
    if (idx !== -1) {
      const old = windows.value[idx]
      const updated = new WorkWindow({
        id: old.id, specialist_id: old.specialistId, application_id: old.applicationId,
        start_time: old.startTime, end_time: old.endTime, scheduled_date: old.scheduledDate,
        opening_count: old.openingCount, current_count: old.currentCount,
        inherits_on_reopen: old.inheritsOnReopen, is_active: true,
        created_at: old.createdAt, closed_at: null,
        closing_count: null, inherited_from_window_id: old.inheritedFromWindowId,
        deleted_at: old.deletedAt,
      })
      windows.value = [...windows.value.slice(0, idx), updated, ...windows.value.slice(idx + 1)]
    }
    selectedWindow.value = null
    showToast('Sesión abierta.')
  } catch (e) {
    logger.error('[Calendario] Error abriendo sesión:', e)
    showToast(e.userMessage || 'Error al abrir sesión.', 'error')
  }
}

// ---- Cerrar sesion (optimista) ----
const handleCloseSession = async (w) => {
  try {
    await closeWorkWindowUseCase(w.id)
    const idx = windows.value.findIndex(x => x.id === w.id)
    if (idx !== -1) {
      const old = windows.value[idx]
      const updated = new WorkWindow({
        id: old.id, specialist_id: old.specialistId, application_id: old.applicationId,
        start_time: old.startTime, end_time: old.endTime, scheduled_date: old.scheduledDate,
        opening_count: old.openingCount, current_count: old.currentCount,
        inherits_on_reopen: old.inheritsOnReopen, is_active: false,
        created_at: old.createdAt, closed_at: new Date().toISOString(),
        closing_count: old.currentCount, inherited_from_window_id: old.inheritedFromWindowId,
        deleted_at: old.deletedAt,
      })
      windows.value = [...windows.value.slice(0, idx), updated, ...windows.value.slice(idx + 1)]
    }
    selectedWindow.value = null
    showToast('Sesión cerrada.')
  } catch (e) {
    logger.error('[Calendario] Error cerrando sesión:', e)
    showToast(e.userMessage || 'Error al cerrar sesión.', 'error')
  }
}

// ---- Eliminar ventana (optimista) ----
const handleDelete = async (w) => {
  try {
    await deleteWorkWindowUseCase(w.id)
    windows.value = windows.value.filter(x => x.id !== w.id)
    selectedWindow.value = null
    showToast('Ventana eliminada.')
  } catch (e) {
    logger.error('[Calendario] Error eliminando ventana:', e)
    showToast(e.userMessage || 'Error al eliminar ventana.', 'error')
  }
}

// ---- Helpers ----
const findSpec = (id) => userStore.users.find(u => u.specialistId === id)
const findApp = (id) => userStore.applications.find(a => a.id === id)
const specName = (w) => findSpec(w.specialistId)?.fullName || w.specialistId
const appName = (w) => findApp(w.applicationId)?.name || w.applicationId

// ---- Navegacion semana ----
const prevWeek = () => weekOffset.value--
const nextWeek = () => weekOffset.value++
const goToday = () => { weekOffset.value = 0 }

watch(weekOffset, () => loadWindows())

// ---- ESC ----
const onEsc = (e) => {
  if (e.key === 'Escape') {
    if (selectedWindow.value) selectedWindow.value = null
    else if (mostrarCrear.value) { mostrarCrear.value = false; prefillData.value = null; errorCrear.value = '' }
  }
}

onMounted(() => {
  loadWindows()
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
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-header__title">Calendario</h1>
        <p class="page-header__subtitle">Programador de <strong>ventanas de trabajo</strong></p>
      </div>
      <button v-if="authStore.isAdmin" @click="openCreatePanel" class="btn-create">
        <i class='bx bx-plus'></i>
        <span class="btn-create__label">Nueva Ventana</span>
        <span class="btn-create__short">Nueva</span>
      </button>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar__left">
        <div class="toolbar__nav">
          <button class="toolbar__arrow" @click="prevWeek" title="Semana anterior">
            <i class='bx bx-chevron-left'></i>
          </button>
          <button class="toolbar__today" @click="goToday">Hoy</button>
          <button class="toolbar__arrow" @click="nextWeek" title="Semana siguiente">
            <i class='bx bx-chevron-right'></i>
          </button>
        </div>
        <span class="toolbar__label">{{ weekLabel }}</span>
      </div>

      <div class="toolbar__right">
        <div class="toolbar__legend">
          <span class="toolbar__legend-item">
            <span class="toolbar__dot toolbar__dot--open"></span>Abierta
          </span>
          <span class="toolbar__legend-item">
            <span class="toolbar__dot toolbar__dot--closed"></span>Cerrada
          </span>
          <span class="toolbar__legend-item">
            <span class="toolbar__dot toolbar__dot--inactive"></span>Inactiva
          </span>
        </div>
        <div class="toolbar__filters">
          <select v-if="authStore.isAdmin" v-model="filtroSpecialist" class="toolbar__select">
            <option value="all">Todos los especialistas</option>
            <option v-for="s in specOptions" :key="s.specialistId" :value="s.specialistId">
              {{ s.fullName }}
            </option>
          </select>
          <select v-model="filtroApp" class="toolbar__select">
            <option value="all">Todas las apps</option>
            <option v-for="a in appOptions" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <SectionLoader v-if="loading" message="Cargando ventanas de trabajo..." />

    <!-- Calendario -->
    <WeekCalendar
      v-else
      :windows="windowsFiltradas"
      :week-dates="weekDates"
      :specialists="userStore.users"
      :applications="userStore.applications"
      :selectable="authStore.isAdmin"
      @select="selectedWindow = $event"
      @range-selected="onRangeSelected"
    />

    <!-- Modal detalle -->
    <WorkWindowModal
      v-if="selectedWindow"
      :window="selectedWindow"
      :specialist-name="specName(selectedWindow)"
      :application-name="appName(selectedWindow)"
      @close="selectedWindow = null"
      @open="handleOpen"
      @close-session="handleCloseSession"
      @delete="handleDelete"
    />

    <!-- Modal crear -->
    <CreateWorkWindowModal
      :visible="mostrarCrear"
      :creating="creando"
      :error="errorCrear"
      :specialists="specialistsConVentana"
      :applications="userStore.applications"
      :prefill="prefillData"
      @close="mostrarCrear = false; errorCrear = ''; prefillData = null"
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
  gap: 0.75rem;
}

/* ---- Header ---- */
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

.page-header__subtitle {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
}

.btn-create {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  background-color: var(--primary-500);
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background-color 0.15s, box-shadow 0.15s, transform 0.1s;
  box-shadow: 0 1px 3px rgba(42, 199, 143, 0.25);
}

.btn-create:hover {
  background-color: var(--primary-600);
  box-shadow: 0 3px 10px rgba(42, 199, 143, 0.3);
}

.btn-create:active {
  transform: scale(0.97);
}

.btn-create i {
  font-size: 1.1rem;
}

.btn-create__short {
  display: none;
}

/* ---- Toolbar ---- */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: var(--bg-main);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  flex-wrap: wrap;
}

.toolbar__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar__nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.toolbar__arrow {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 1.15rem;
  padding: 0.25rem 0.35rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}

.toolbar__arrow:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
  background: rgba(42, 199, 143, 0.04);
}

.toolbar__today {
  background: none;
  border: 1px solid var(--border-light);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar__today:hover {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}

.toolbar__label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Legend inline */
.toolbar__legend {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.toolbar__legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 500;
  color: #8993a4;
}

.toolbar__dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  border-left: 2.5px solid;
}

.toolbar__dot--open {
  background: rgba(42, 199, 143, 0.15);
  border-left-color: var(--primary-500);
}

.toolbar__dot--closed {
  background: rgba(96, 125, 234, 0.12);
  border-left-color: #607dea;
}

.toolbar__dot--inactive {
  background: #f0f1f3;
  border-left-color: #c1c7d0;
}

/* Filters */
.toolbar__filters {
  display: flex;
  gap: 0.4rem;
}

.toolbar__select {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--text-primary);
  background: var(--bg-main);
  cursor: pointer;
  transition: border-color 0.15s;
}

.toolbar__select:focus {
  outline: none;
  border-color: var(--primary-500);
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .btn-create__label { display: none; }
  .btn-create__short { display: inline; }
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar__left {
    justify-content: center;
  }
  .toolbar__right {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar__legend {
    justify-content: center;
  }
  .toolbar__filters {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .toolbar__legend {
    display: none;
  }
}
</style>

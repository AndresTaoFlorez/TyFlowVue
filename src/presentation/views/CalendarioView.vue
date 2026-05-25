<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { fetchWorkWindowsUseCase } from '@/application/use-cases/work-windows/FetchWorkWindowsUseCase'
import { createWorkWindowUseCase } from '@/application/use-cases/work-windows/CreateWorkWindowUseCase'
import { openWorkWindowUseCase } from '@/application/use-cases/work-windows/OpenWorkWindowUseCase'
import { closeWorkWindowUseCase } from '@/application/use-cases/work-windows/CloseWorkWindowUseCase'
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

// ---- Cargar ventanas ----
const loadWindows = async () => {
  loading.value = true
  try {
    windows.value = await fetchWorkWindowsUseCase()
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

// ---- Crear ventana ----
const handleCreate = async (data) => {
  creando.value = true
  errorCrear.value = ''
  try {
    await createWorkWindowUseCase(data)
    mostrarCrear.value = false
    prefillData.value = null
    await loadWindows()
    showToast('Ventana de trabajo creada.')
  } catch (e) {
    logger.error('[Calendario] Error creando ventana:', e)
    errorCrear.value = e.userMessage || 'Error al crear la ventana.'
  } finally {
    creando.value = false
  }
}

// ---- Abrir sesion ----
const handleOpen = async (w) => {
  try {
    await openWorkWindowUseCase(w.id)
    await loadWindows()
    selectedWindow.value = null
    showToast('Sesión abierta.')
  } catch (e) {
    logger.error('[Calendario] Error abriendo sesión:', e)
    showToast(e.userMessage || 'Error al abrir sesión.', 'error')
  }
}

// ---- Cerrar sesion ----
const handleCloseSession = async (w) => {
  try {
    await closeWorkWindowUseCase(w.id)
    await loadWindows()
    selectedWindow.value = null
    showToast('Sesión cerrada.')
  } catch (e) {
    logger.error('[Calendario] Error cerrando sesión:', e)
    showToast(e.userMessage || 'Error al cerrar sesión.', 'error')
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
const goToday = () => weekOffset.value = 0

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

    <!-- Toolbar: navegacion + filtros -->
    <div class="toolbar">
      <div class="toolbar__nav">
        <button class="toolbar__btn" @click="prevWeek" title="Semana anterior">
          <i class='bx bx-chevron-left'></i>
        </button>
        <button class="toolbar__today" @click="goToday">Hoy</button>
        <button class="toolbar__btn" @click="nextWeek" title="Semana siguiente">
          <i class='bx bx-chevron-right'></i>
        </button>
        <span class="toolbar__label">{{ weekLabel }}</span>
      </div>

      <div class="toolbar__filters">
        <select v-if="authStore.isAdmin" v-model="filtroSpecialist" class="toolbar__select">
          <option value="all">Todos los especialistas</option>
          <option v-for="s in specOptions" :key="s.specialistId" :value="s.specialistId">
            {{ s.fullName }}
          </option>
        </select>
        <select v-model="filtroApp" class="toolbar__select">
          <option value="all">Todas las aplicaciones</option>
          <option v-for="a in appOptions" :key="a.id" :value="a.id">
            {{ a.name }}
          </option>
        </select>
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

    <!-- Leyenda -->
    <div class="legend">
      <div class="legend__item">
        <span class="legend__dot legend__dot--open"></span> Sesión abierta
      </div>
      <div class="legend__item">
        <span class="legend__dot legend__dot--closed"></span> Sesión cerrada
      </div>
      <div class="legend__item">
        <span class="legend__dot legend__dot--inactive"></span> Inactiva
      </div>
    </div>

    <!-- Modal detalle -->
    <WorkWindowModal
      v-if="selectedWindow"
      :window="selectedWindow"
      :specialist-name="specName(selectedWindow)"
      :application-name="appName(selectedWindow)"
      @close="selectedWindow = null"
      @open="handleOpen"
      @close-session="handleCloseSession"
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
  gap: 1.25rem;
}

/* ---- Header ---- */
.page-header {
  display: flex;
  align-items: flex-start;
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

/* ---- Toolbar ---- */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: white;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  flex-wrap: wrap;
}

.toolbar__nav {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.toolbar__btn {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 1.2rem;
  padding: 0.3rem 0.4rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.15s, border-color 0.15s;
}

.toolbar__btn:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
}

.toolbar__today {
  background: none;
  border: 1px solid var(--border-light);
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
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
  margin-left: 0.5rem;
  white-space: nowrap;
}

.toolbar__filters {
  display: flex;
  gap: 0.5rem;
}

.toolbar__select {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  color: var(--text-primary);
  background: white;
  cursor: pointer;
}

.toolbar__select:focus {
  outline: none;
  border-color: var(--primary-500);
}

/* ---- Legend ---- */
.legend {
  display: flex;
  gap: 1.25rem;
  padding: 0.5rem 0;
  justify-content: center;
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.legend__dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 2px;
  border-left: 2.5px solid;
}

.legend__dot--open {
  background: #dcfce7;
  border-left-color: #15803d;
}

.legend__dot--closed {
  background: #dbeafe;
  border-left-color: #1d4ed8;
}

.legend__dot--inactive {
  background: #f1f5f9;
  border-left-color: #94a3b8;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .btn-create__label { display: none; }
  .btn-create__short { display: inline; }
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar__nav {
    justify-content: center;
  }
  .toolbar__filters {
    flex-direction: column;
  }
}
</style>

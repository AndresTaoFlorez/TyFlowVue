<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { fetchWorkWindowsUseCase } from '@/application/use-cases/work-windows/FetchWorkWindowsUseCase'
import { createWorkWindowUseCase } from '@/application/use-cases/work-windows/CreateWorkWindowUseCase'
import { openWorkWindowUseCase } from '@/application/use-cases/work-windows/OpenWorkWindowUseCase'
import { closeWorkWindowUseCase } from '@/application/use-cases/work-windows/CloseWorkWindowUseCase'
import { deleteWorkWindowUseCase } from '@/application/use-cases/work-windows/DeleteWorkWindowUseCase'
import { updateWorkWindowUseCase } from '@/application/use-cases/work-windows/UpdateWorkWindowUseCase'
import { rescheduleWorkWindowUseCase } from '@/application/use-cases/work-windows/RescheduleWorkWindowUseCase'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import WeekCalendar from '@/presentation/components/WeekCalendar.vue'
import WorkWindowModal from '@/presentation/components/WorkWindowModal.vue'
import CreateWorkWindowModal from '@/presentation/components/CreateWorkWindowModal.vue'
import WindowGroupPanel from '@/presentation/components/WindowGroupPanel.vue'
import SectionLoader from '@/presentation/components/SectionLoader.vue'
import ToastNotification from '@/presentation/components/ToastNotification.vue'

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
const dayOffset = ref(0)
const monthOffset = ref(0)
const modalLoading = ref(false)
const selectedGroup = ref(null)

// Vista
const calView = ref(window.innerWidth < 768 ? 'day' : 'week')

// Sync offsets when switching views so the same date stays visible
watch(calView, (newView, oldView) => {
  if (newView === 'week') {
    if (oldView === 'day') {
      const target = new Date()
      target.setDate(target.getDate() + dayOffset.value)
      const now = new Date()
      const diffMs = target.getTime() - now.getTime()
      weekOffset.value = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    } else if (oldView === 'month') {
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
      const diffMs = target.getTime() - now.getTime()
      weekOffset.value = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    }
  } else if (newView === 'day') {
    if (oldView === 'week') {
      const now = new Date()
      const day = now.getDay()
      const toMonday = day === 0 ? -6 : 1 - day
      dayOffset.value = toMonday + weekOffset.value * 7
    } else if (oldView === 'month') {
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
      dayOffset.value = Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    }
  } else if (newView === 'month') {
    if (oldView === 'week') {
      const now = new Date()
      const monday = new Date(now)
      const day = monday.getDay()
      const diff = day === 0 ? -6 : 1 - day
      monday.setDate(monday.getDate() + diff + weekOffset.value * 7)
      monthOffset.value = (monday.getFullYear() - now.getFullYear()) * 12 + (monday.getMonth() - now.getMonth())
    } else if (oldView === 'day') {
      const now = new Date()
      const target = new Date()
      target.setDate(target.getDate() + dayOffset.value)
      monthOffset.value = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
    }
  }
})

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

// ---- Fechas visibles ----
const weekDates = computed(() => {
  if (calView.value === 'month') {
    // Return the full month range (from monthDates) for API fetching
    return monthDates.value.length ? [monthDates.value[0], monthDates.value[monthDates.value.length - 1]] : []
  }
  if (calView.value === 'day') {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset.value)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return [`${y}-${m}-${dd}`]
  }
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

// ---- Month grid dates (42 = 6 weeks × 7 days, starting from Monday) ----
const monthDates = computed(() => {
  if (calView.value !== 'month') return []
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
  // Monday before (or on) the 1st
  const day = first.getDay()
  const toMonday = day === 0 ? -6 : 1 - day
  const start = new Date(first)
  start.setDate(first.getDate() + toMonday)
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return fmt(d)
  })
})

const currentMonth = computed(() => {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
  return d.getMonth()
})

const weekLabel = computed(() => {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const mesesLargo = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  if (calView.value === 'month') {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1)
    return `${mesesLargo[d.getMonth()]} ${d.getFullYear()}`
  }
  if (calView.value === 'day') {
    const diasCorto = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const diasLargo = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const parts = weekDates.value[0].split('-')
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    const dayName = isMobile.value ? diasCorto[dateObj.getDay()] : diasLargo[dateObj.getDay()]
    return `${dayName}, ${parseInt(parts[2])} ${meses[parseInt(parts[1]) - 1]}`
  }
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
    const fromDate = weekDates.value[0]
    const toDate = weekDates.value[weekDates.value.length - 1]
    const tzOffset = WorkWindow.toTimestampTz(fromDate, '00:00')?.slice(-6) || '-05:00'
    windows.value = await fetchWorkWindowsUseCase({
      date_from: `${fromDate}T00:00:00${tzOffset}`,
      date_to: `${toDate}T23:59:59${tzOffset}`,
    })
  } catch (e) {
    console.error('[Calendario] Error cargando ventanas:', e)
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

// ---- Crear ventanas ----
const handleCreate = async (data) => {
  creando.value = true
  errorCrear.value = ''
  try {
    const created = await createWorkWindowUseCase(data)
    windows.value = [...windows.value, ...created]
    mostrarCrear.value = false
    prefillData.value = null
    const n = created.length
    showToast(n === 1 ? 'Ventana de trabajo creada.' : `${n} ventanas de trabajo creadas.`)
  } catch (e) {
    console.error('[Calendario] Error creando ventana:', e)
    errorCrear.value = e.userMessage || 'Error al crear la ventana.'
  } finally {
    creando.value = false
  }
}

// ---- Abrir sesion ----
const handleOpen = async (w) => {
  modalLoading.value = true
  try {
    const updated = await openWorkWindowUseCase(w)
    const idx = windows.value.findIndex(x => x.id === w.id)
    if (idx !== -1) {
      windows.value = [...windows.value.slice(0, idx), updated, ...windows.value.slice(idx + 1)]
    }
    selectedWindow.value = null
    syncGroupWindow(updated)
    showToast('Sesión abierta.')
  } catch (e) {
    console.error('[Calendario] Error abriendo sesión:', e)
    showToast(e.userMessage || 'Error al abrir sesión.', 'error')
  } finally {
    modalLoading.value = false
  }
}

// ---- Cerrar sesion ----
const handleCloseSession = async (w) => {
  modalLoading.value = true
  try {
    const updated = await closeWorkWindowUseCase(w)
    const idx = windows.value.findIndex(x => x.id === w.id)
    if (idx !== -1) {
      windows.value = [...windows.value.slice(0, idx), updated, ...windows.value.slice(idx + 1)]
    }
    selectedWindow.value = null
    syncGroupWindow(updated)
    showToast('Sesión cerrada.')
  } catch (e) {
    console.error('[Calendario] Error cerrando sesión:', e)
    showToast(e.userMessage || 'Error al cerrar sesión.', 'error')
  } finally {
    modalLoading.value = false
  }
}

// ---- Sync group panel after mutations ----
function syncGroupWindow(updated) {
  if (!selectedGroup.value) return
  const g = selectedGroup.value
  const idx = g.windows.findIndex(x => x.id === updated.id)
  if (idx !== -1) {
    g.windows = [...g.windows.slice(0, idx), updated, ...g.windows.slice(idx + 1)]
    selectedGroup.value = { ...g }
  }
}

function removeFromGroup(id) {
  if (!selectedGroup.value) return
  const g = selectedGroup.value
  const filtered = g.windows.filter(x => x.id !== id)
  if (filtered.length === 0) {
    selectedGroup.value = null
  } else {
    selectedGroup.value = { ...g, windows: filtered }
  }
}

// ---- Eliminar ventana ----
const handleDelete = async (w) => {
  modalLoading.value = true
  try {
    await deleteWorkWindowUseCase(w.id)
    windows.value = windows.value.filter(x => x.id !== w.id)
    selectedWindow.value = null
    removeFromGroup(w.id)
    showToast('Ventana eliminada.')
  } catch (e) {
    console.error('[Calendario] Error eliminando ventana:', e)
    showToast(e.userMessage || 'Error al eliminar ventana.', 'error')
  } finally {
    modalLoading.value = false
  }
}

// ---- Actualizar ventana (edición de horario) ----
const handleUpdate = async (w, payload) => {
  modalLoading.value = true
  try {
    const updated = await updateWorkWindowUseCase(w, payload)
    const idx = windows.value.findIndex(x => x.id === w.id)
    if (idx !== -1) {
      windows.value = [...windows.value.slice(0, idx), updated, ...windows.value.slice(idx + 1)]
    }
    selectedWindow.value = updated
    showToast('Horario actualizado.')
  } catch (e) {
    console.error('[Calendario] Error actualizando ventana:', e)
    showToast(e.userMessage || 'Error al actualizar la ventana.', 'error')
  } finally {
    modalLoading.value = false
  }
}

// ---- Optimistic helpers ----
function findOriginal(id) {
  return windows.value.find(x => x.id === id)
}

function buildOptimisticWindow(original, { startTime, endTime, targetDate }) {
  const date = targetDate || original.scheduledDate
  const raw = original._toRaw()
  raw.starts_at = WorkWindow.toTimestampTz(date, startTime)
  raw.ends_at = WorkWindow.toTimestampTz(date, endTime)
  return new WorkWindow(raw)
}

function replaceWindow(id, updated) {
  const idx = windows.value.findIndex(x => x.id === id)
  if (idx !== -1) {
    windows.value = [...windows.value.slice(0, idx), updated, ...windows.value.slice(idx + 1)]
  }
}

// ---- Resize (drag edge to stretch) ----
const handleResize = async ({ window: w, startTime, endTime }) => {
  const original = findOriginal(w.id)
  if (!original) return
  const optimistic = buildOptimisticWindow(original, { startTime, endTime })
  replaceWindow(w.id, optimistic)

  try {
    const confirmed = await updateWorkWindowUseCase(original, { startTime, endTime })
    replaceWindow(w.id, confirmed)
  } catch (e) {
    replaceWindow(w.id, original)
    console.error('[Calendario] Error redimensionando ventana:', e)
    showToast(e.userMessage || 'Error al redimensionar la ventana.', 'error')
  }
}

// ---- Reschedule (drag-to-move) ----
const handleReschedule = async ({ window: w, targetDate, startTime, endTime }) => {
  const original = findOriginal(w.id)
  if (!original) return
  const optimistic = buildOptimisticWindow(original, { startTime, endTime, targetDate })
  replaceWindow(w.id, optimistic)

  try {
    const confirmed = await rescheduleWorkWindowUseCase(original, { startTime, endTime, targetDate })
    replaceWindow(w.id, confirmed)
  } catch (e) {
    replaceWindow(w.id, original)
    console.error('[Calendario] Error moviendo ventana:', e)
    showToast(e.userMessage || 'Error al mover la ventana.', 'error')
  }
}

// ---- Agregar ventana al mismo horario ----
const handleAddWindow = async (data) => {
  try {
    const created = await createWorkWindowUseCase([data])
    windows.value = [...windows.value, ...created]
    showToast('Ventana agregada al mismo horario.')
  } catch (e) {
    console.error('[Calendario] Error agregando ventana:', e)
    showToast(e.userMessage || 'Error al agregar la ventana.', 'error')
  }
}

// ---- Group reschedule (drag-to-move all windows in group) ----
const handleGroupReschedule = async ({ group, targetDate, deltaHours }) => {
  const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const toHM = (decimal) => {
    const h = Math.floor(decimal)
    const m = Math.round((decimal % 1) * 60)
    return fmt(h, m)
  }

  // Optimistic: update all windows in the group immediately
  const originals = new Map()
  for (const gw of group.windows) {
    const orig = findOriginal(gw.id)
    if (!orig) continue
    originals.set(gw.id, orig)
    const newStart = orig.startHour + deltaHours
    const newEnd = orig.endHour + deltaHours
    const optimistic = buildOptimisticWindow(orig, {
      startTime: toHM(newStart),
      endTime: toHM(newEnd),
      targetDate,
    })
    replaceWindow(gw.id, optimistic)
  }

  try {
    const updates = await Promise.all(
      [...originals.values()].map(async (w) => {
        const newStart = w.startHour + deltaHours
        const newEnd = w.endHour + deltaHours
        return rescheduleWorkWindowUseCase(w, {
          startTime: toHM(newStart),
          endTime: toHM(newEnd),
          targetDate,
        })
      })
    )
    const updatedMap = new Map(updates.map(u => [u.id, u]))
    windows.value = windows.value.map(w => updatedMap.get(w.id) || w)
  } catch (e) {
    // Rollback
    windows.value = windows.value.map(w => originals.get(w.id) || w)
    console.error('[Calendario] Error moviendo grupo:', e)
    showToast(e.userMessage || 'Error al mover el grupo.', 'error')
  }
}

// ---- Group panel: select individual from group ----
const onGroupSelect = (w) => {
  selectedGroup.value = null
  selectedWindow.value = w
}

// ---- Helpers ----
const findSpec = (id) => userStore.users.find(u => u.specialistId === id)
const findApp = (id) => userStore.applications.find(a => a.id === id)
const specName = (w) => findSpec(w.specialistId)?.fullName || w.specialistId
const appName = (w) => findApp(w.applicationId)?.name || w.applicationId

// ---- Navegacion ----
const prevNav = () => {
  if (calView.value === 'day') dayOffset.value--
  else if (calView.value === 'month') monthOffset.value--
  else weekOffset.value--
}
const nextNav = () => {
  if (calView.value === 'day') dayOffset.value++
  else if (calView.value === 'month') monthOffset.value++
  else weekOffset.value++
}
const goToday = () => {
  if (calView.value === 'day') dayOffset.value = 0
  else if (calView.value === 'month') monthOffset.value = 0
  else weekOffset.value = 0
}

const handleSelectDay = (dateStr) => {
  // Switch to day view at the selected date
  const target = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  dayOffset.value = Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  calView.value = 'day'
}

const handleNextDay = () => { dayOffset.value++ }
const handlePrevDay = () => { dayOffset.value-- }

watch([weekDates, monthDates], () => loadWindows())

// ---- Mobile ----
const isMobile = ref(window.innerWidth < 768)
const showMobileFilters = ref(false)
function onResize() { isMobile.value = window.innerWidth < 768 }

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
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
  window.removeEventListener('resize', onResize)
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
      <button v-if="authStore.isAdmin && !isMobile" @click="openCreatePanel" class="btn-create">
        <i class='bx bx-plus'></i>
        <span class="btn-create__label">Nueva Ventana</span>
        <span class="btn-create__short">Nueva</span>
      </button>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <!-- Row 1: nav + label -->
      <div class="toolbar__row">
        <button class="toolbar__arrow" @click="prevNav">
          <i class='bx bx-chevron-left'></i>
        </button>
        <button class="toolbar__today" @click="goToday">Hoy</button>
        <button class="toolbar__arrow" @click="nextNav">
          <i class='bx bx-chevron-right'></i>
        </button>
        <span class="toolbar__label">{{ weekLabel }}</span>

        <!-- View toggle (siempre visible) -->
        <div class="toolbar__views">
          <button class="toolbar__view-btn" :class="{ 'toolbar__view-btn--active': calView === 'day' }"
            @click="calView = 'day'">Día</button>
          <button class="toolbar__view-btn" :class="{ 'toolbar__view-btn--active': calView === 'week' }"
            @click="calView = 'week'">Semana</button>
          <button class="toolbar__view-btn" :class="{ 'toolbar__view-btn--active': calView === 'month' }"
            @click="calView = 'month'">Mes</button>
        </div>

        <!-- Filter toggle (mobile only, collapses filters) -->
        <button v-if="isMobile" class="toolbar__filter-toggle"
          :class="{ 'toolbar__filter-toggle--active': showMobileFilters }"
          @click="showMobileFilters = !showMobileFilters">
          <i class='bx bx-filter-alt'></i>
        </button>
      </div>

      <!-- Row 2: legend + filters (desktop inline / mobile collapsible) -->
      <div v-if="!isMobile" class="toolbar__row toolbar__row--secondary">
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

      <!-- Mobile: collapsible filters -->
      <div v-if="isMobile && showMobileFilters" class="toolbar__mobile-filters">
        <select v-if="authStore.isAdmin" v-model="filtroSpecialist" class="toolbar__select toolbar__select--full">
          <option value="all">Todos los especialistas</option>
          <option v-for="s in specOptions" :key="s.specialistId" :value="s.specialistId">
            {{ s.fullName }}
          </option>
        </select>
        <select v-model="filtroApp" class="toolbar__select toolbar__select--full">
          <option value="all">Todas las apps</option>
          <option v-for="a in appOptions" :key="a.id" :value="a.id">
            {{ a.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <SectionLoader v-if="loading" message="Cargando ventanas de trabajo..." />

    <!-- Calendario -->
    <WeekCalendar v-else :windows="windowsFiltradas" :week-dates="weekDates" :specialists="userStore.users"
      :applications="userStore.applications" :selectable="authStore.isAdmin" :is-mobile="isMobile" :view-mode="calView"
      :month-dates="monthDates" :current-month="currentMonth" @select="selectedWindow = $event"
      @group-select="selectedGroup = $event" @range-selected="onRangeSelected" @reschedule="handleReschedule"
      @group-reschedule="handleGroupReschedule" @next-day="handleNextDay" @prev-day="handlePrevDay"
      @resize="handleResize" @select-day="handleSelectDay" />

    <!-- Modal detalle -->
    <WorkWindowModal v-if="selectedWindow" :window="selectedWindow" :specialist-name="specName(selectedWindow)"
      :application-name="appName(selectedWindow)" :loading="modalLoading" :specialists="specialistsConVentana"
      :applications="userStore.applications" @close="selectedWindow = null" @open="handleOpen"
      @close-session="handleCloseSession" @delete="handleDelete" @update="handleUpdate" @add-window="handleAddWindow" />

    <!-- Panel grupo -->
    <WindowGroupPanel v-if="selectedGroup" :group="selectedGroup" :specialists="userStore.users"
      :applications="userStore.applications" :loading="modalLoading" @close="selectedGroup = null"
      @select="onGroupSelect" @open="handleOpen" @close-session="handleCloseSession" @delete="handleDelete" />

    <!-- Modal crear -->
    <CreateWorkWindowModal :visible="mostrarCrear" :creating="creando" :error="errorCrear"
      :specialists="specialistsConVentana" :applications="userStore.applications" :prefill="prefillData"
      @close="mostrarCrear = false; errorCrear = ''; prefillData = null" @create="handleCreate" />

    <!-- Mobile FAB -->
    <button v-if="authStore.isAdmin && isMobile" class="btn-fab" @click="openCreatePanel">
      <i class='bx bx-plus'></i>
    </button>

    <ToastNotification :visible="toastVisible" :message="toastMessage" :type="toastType"
      @close="toastVisible = false" />
  </section>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
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

/* ---- Mobile FAB ---- */
.btn-fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--primary-500);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  box-shadow: 0 4px 14px rgba(42, 199, 143, 0.4);
  z-index: 50;
  transition: background-color 0.15s, transform 0.1s;
}

.btn-fab:hover {
  background-color: var(--primary-600);
}

.btn-fab:active {
  transform: scale(0.93);
}

/* ---- Filter toggle ---- */
.toolbar__filter-toggle {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 1.1rem;
  padding: 0.25rem 0.4rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}

.toolbar__filter-toggle:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
}

/* ---- Toolbar ---- */
.toolbar {
  background: var(--bg-main);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.toolbar__row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.toolbar__row--secondary {
  gap: 0.5rem;
}

.toolbar__arrow {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 1rem;
  padding: 0.2rem 0.3rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.toolbar__arrow:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
  background: rgba(42, 199, 143, 0.04);
}

.toolbar__today {
  background: none;
  border: 1px solid var(--border-light);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.toolbar__today:hover {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}

.toolbar__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  margin-right: auto;
}

/* View toggle */
.toolbar__views {
  display: flex;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
}

.toolbar__view-btn {
  padding: 0.2rem 0.5rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-main);
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar__view-btn+.toolbar__view-btn {
  border-left: 1px solid var(--border-light);
}

.toolbar__view-btn:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.toolbar__view-btn--active {
  background: var(--primary-500);
  color: white;
}

.toolbar__view-btn--active:hover {
  background: var(--primary-600);
  color: white;
}

/* Legend */
.toolbar__legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.toolbar__legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  font-weight: 500;
  color: #8993a4;
}

.toolbar__dot {
  width: 7px;
  height: 7px;
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
  gap: 0.35rem;
  flex-shrink: 0;
  margin-left: auto;
}

.toolbar__select {
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  color: var(--text-primary);
  background: var(--bg-main);
  cursor: pointer;
  transition: border-color 0.15s;
}

.toolbar__select:focus {
  outline: none;
  border-color: var(--primary-500);
}

.toolbar__select--full {
  width: 100%;
}

/* Mobile filter toggle */
.toolbar__filter-toggle--active {
  color: var(--primary-500);
  border-color: var(--primary-500);
  background: rgba(42, 199, 143, 0.06);
}

/* Mobile collapsible filters */
.toolbar__mobile-filters {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

/* ---- Responsive ---- */

/* Tablet & small desktop */
@media (max-width: 900px) {
  .toolbar__legend {
    display: none;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .content {
    gap: 0.4rem;
  }

  .page-header {
    padding: 0.75rem 1.2rem 0.6rem;
  }

  .page-header__title {
    font-size: 1.05rem;
  }

  .page-header__subtitle {
    display: none;
  }

  .toolbar {
    padding: 0.35rem 0.4rem;
  }

  .toolbar__label {
    font-size: 0.72rem;
  }
}

/* Small phone (375px and below) */
@media (max-width: 390px) {
  .page-header__title {
    font-size: 0.95rem;
  }

  .toolbar {
    padding: 0.3rem;
  }

  .toolbar__row {
    gap: 0.2rem;
  }

  .toolbar__arrow {
    padding: 0.15rem 0.25rem;
    font-size: 0.9rem;
  }

  .toolbar__today {
    padding: 0.15rem 0.35rem;
    font-size: 0.65rem;
  }

  .toolbar__label {
    font-size: 0.65rem;
  }

  .toolbar__view-btn {
    padding: 0.15rem 0.35rem;
    font-size: 0.6rem;
  }

  .btn-fab {
    width: 42px;
    height: 42px;
    font-size: 1.2rem;
    bottom: 1rem;
    right: 1rem;
  }
}
</style>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCalendarStore } from '@/presentation/stores/useCalendarStore'
import WeekCalendar from '@/presentation/components/WeekCalendar.vue'
import WorkWindowModal from '@/presentation/components/WorkWindowModal.vue'
import CreateWorkWindowModal from '@/presentation/components/CreateWorkWindowModal.vue'
import WindowGroupPanel from '@/presentation/components/WindowGroupPanel.vue'
import { fmtHM, fmtTimeFromMins } from '@/presentation/helpers/formatTime'
import SectionLoader from '@/presentation/components/SectionLoader.vue'
import ToastNotification from '@/presentation/components/ToastNotification.vue'
import ContextMenu from '@/presentation/components/ContextMenu.vue'
import { BP_MOBILE } from '@/presentation/utils/breakpoints'

const authStore = useAuthStore()
const userStore = useUserStore()
const calStore = useCalendarStore()

const {
  calView, weekDates, monthDates, currentMonth, weekLabel,
  loading, windowsFiltradas, monthOffset,
  filtroSpecialist, filtroApp, specOptions, appOptions, specialistsConVentana,
  isMobile, canUndo,
} = storeToRefs(calStore)

// ---- Date picker ----
const datePickerRef = ref(null)
const openDatePicker = () => { datePickerRef.value?.showPicker() }
const onDatePicked = (e) => {
  const val = e.target.value
  if (val) calStore.goToDate(val)
}

// ---- Ephemeral UI state (view-only, not shared) ----
const selectedWindow = ref(null)
const openModalInEdit = ref(false)
const mostrarCrear = ref(false)
const creando = ref(false)
const errorCrear = ref('')
const prefillData = ref(null)
const modalLoading = ref(false)
const selectedGroup = ref(null)
const showMobileFilters = ref(false)
const slideDir = ref('') // 'slide-left' | 'slide-right'

// Month strip for mobile month view
const monthStripItems = computed(() => {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const off = monthOffset.value + (i - 3)
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1)
    return { offset: off, label: meses[d.getMonth()] }
  })
})

// Tool mode & selection
const activeTool = ref('default') // 'default' | 'eraser' | 'select'
const selectedWindows = ref(new Set())

function setTool(tool) {
  activeTool.value = tool
  selectedWindows.value = new Set()
}

function onSelectionChange(ids) {
  selectedWindows.value = ids
}

// Context menu & clipboard
const ctxMenu = ref({ visible: false, x: 0, y: 0, items: [], target: null, targetType: null })
const clipboard = ref(null)
const cutWindowIds = ref(new Set())

function closeCtxMenu() { ctxMenu.value.visible = false }

async function pasteOnSlot(date, startTime, endTime) {
  if (!clipboard.value) return
  const pasteWindows = clipboard.value.type === 'group' ? clipboard.value.data : [clipboard.value.data]
  try {
    const createData = pasteWindows.map(w => ({
      specialistId: w.specialistId,
      applicationId: w.applicationId,
      startTime,
      endTime,
      scheduledDate: date,
      inheritsOnReopen: w.inheritsOnReopen || false,
      affinityWeight: w.affinityWeight ?? null,
    }))
    await calStore.createWindows(createData)
    if (clipboard.value.cut) {
      const cutIds = pasteWindows.map(w => w.id).filter(Boolean)
      if (cutIds.length > 0) await calStore.batchDelete(cutIds)
      cutWindowIds.value = new Set()
      clipboard.value = null
    }
    showToast(createData.length === 1 ? 'Ventana pegada.' : `${createData.length} ventanas pegadas.`)
  } catch (e) {
    showToast(e.userMessage || 'Error al pegar.', 'error')
  }
}

function onWindowContext({ window: w, x, y }) {
  const isFutureWindow = w.startsAt && new Date(w.startsAt) > new Date()
  const isEndedWindow = w.endsAt && new Date(w.endsAt) < new Date()
  const hasInheritance = !!(w.inheritedFromWindowId || w.inheritsOnReopen)
  const inheritItem = isFutureWindow
    ? (hasInheritance
      ? { label: 'Desactivar herencia', icon: 'bx-unlink', action: 'disinherit' }
      : { label: 'Activar herencia', icon: 'bx-link', action: 'reinherit' })
    : null
  const items = [
    ...(!isEndedWindow ? [{ label: 'Editar', icon: 'bx-pencil', action: 'edit' }] : []),
    { label: 'Agregar especialista', icon: 'bx-user-plus', action: 'add-specialist' },
    ...(!isEndedWindow ? [{ label: w.isActive ? 'Inhabilitar' : 'Habilitar', icon: w.isActive ? 'bx-block' : 'bx-check-circle', action: 'toggle' }] : []),
    ...(inheritItem ? [inheritItem] : []),
    { label: 'Copiar ventana', icon: 'bx-copy', action: 'copy' },
    ...(isFutureWindow ? [{ label: 'Cortar ventana', icon: 'bx-cut', action: 'cut' }] : []),
    ...(clipboard.value ? [{ label: 'Pegar aquí', icon: 'bx-paste', action: 'paste-on-window' }] : []),
    { label: 'Copiar ID', icon: 'bx-hash', action: 'copy-id' },
    { label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true },
  ]
  ctxMenu.value = { visible: true, x, y, items, target: w, targetType: 'window' }
}

function onGroupContext({ group, x, y }) {
  const allGroupFuture = group.windows.every(w => w.startsAt && new Date(w.startsAt) > new Date())
  const items = [
    { label: 'Ver grupo', icon: 'bx-expand-alt', action: 'view-group' },
    { label: 'Agregar especialista', icon: 'bx-user-plus', action: 'add-to-group' },
    { label: 'Copiar grupo', icon: 'bx-copy', action: 'copy-group' },
    ...(allGroupFuture ? [{ label: 'Cortar grupo', icon: 'bx-cut', action: 'cut-group' }] : []),
    ...(clipboard.value ? [{ label: 'Pegar aquí', icon: 'bx-paste', action: 'paste-on-group' }] : []),
    { label: 'Eliminar grupo', icon: 'bx-trash', action: 'delete-group', danger: true },
  ]
  ctxMenu.value = { visible: true, x, y, items, target: group, targetType: 'group' }
}

function onCellContext({ date, time, x, y }) {
  const items = [
    { label: 'Crear ventana', icon: 'bx-plus', action: 'create' },
    ...(clipboard.value ? [{ label: 'Pegar ventana', icon: 'bx-paste', action: 'paste' }] : []),
  ]
  ctxMenu.value = { visible: true, x, y, items, target: { date, time }, targetType: 'cell' }
}

async function handleCtxAction(action) {
  const { target, targetType } = ctxMenu.value
  closeCtxMenu()

  if (targetType === 'window') {
    const w = target
    switch (action) {
      case 'edit':
        selectedWindow.value = null
        openModalInEdit.value = false
        await nextTick()
        openModalInEdit.value = true
        selectedWindow.value = w
        break
      case 'add-specialist':
        prefillData.value = {
          dates: [w.scheduledDate],
          startTime: w.startTime,
          endTime: w.endTime,
          applicationId: w.applicationId,
        }
        mostrarCrear.value = true
        break
      case 'copy':
        clipboard.value = { type: 'window', data: w, cut: false }
        cutWindowIds.value = new Set()
        showToast('Ventana copiada.')
        break
      case 'cut':
        clipboard.value = { type: 'window', data: w, cut: true }
        cutWindowIds.value = new Set([w.id])
        showToast('Ventana cortada.')
        break
      case 'copy-id':
        await navigator.clipboard.writeText(w.id)
        showToast('ID copiado: ' + w.id)
        break
      case 'paste-on-window':
        await pasteOnSlot(w.scheduledDate, w.startTime, w.endTime)
        break
      case 'disinherit': handleDisinherit(w); break
      case 'reinherit': handleReinherit(w); break
      case 'toggle': handleToggle(w); break
      case 'delete': handleDelete(w); break
    }
  } else if (targetType === 'group') {
    const group = target
    switch (action) {
      case 'view-group': selectedGroup.value = group; break
      case 'add-to-group': {
        const firstW = group.windows[0]
        const startH = Math.floor(group.startHour)
        const startM = Math.round((group.startHour % 1) * 60)
        const endH = Math.floor(group.endHour)
        const endM = Math.round((group.endHour % 1) * 60)
        prefillData.value = {
          dates: [firstW.scheduledDate],
          startTime: fmtHM(startH, startM),
          endTime: fmtHM(endH, endM),
        }
        mostrarCrear.value = true
        break
      }
      case 'copy-group':
        clipboard.value = { type: 'group', data: group.windows, cut: false }
        cutWindowIds.value = new Set()
        showToast(`${group.windows.length} ventanas copiadas.`)
        break
      case 'cut-group':
        clipboard.value = { type: 'group', data: group.windows, cut: true }
        cutWindowIds.value = new Set(group.windows.map(w => w.id))
        showToast(`${group.windows.length} ventanas cortadas.`)
        break
      case 'paste-on-group': {
        const startH = Math.floor(group.startHour)
        const startM = Math.round((group.startHour % 1) * 60)
        const endH = Math.floor(group.endHour)
        const endM = Math.round((group.endHour % 1) * 60)
        await pasteOnSlot(group.windows[0].scheduledDate, fmtHM(startH, startM), fmtHM(endH, endM))
        break
      }
      case 'delete-group': handleDeleteGroup(group); break
    }
  } else if (targetType === 'cell') {
    const { date, time } = target
    const endSlot = parseInt(time.split(':')[0]) * 2 + (parseInt(time.split(':')[1]) >= 30 ? 1 : 0) + 2
    const endTime = fmtHM(Math.floor(endSlot / 2), (endSlot % 2) * 30)
    switch (action) {
      case 'create':
        prefillData.value = { dates: [date], startTime: time, endTime }
        mostrarCrear.value = true
        break
      case 'paste':
        if (!clipboard.value) break
        const pasteWindows = clipboard.value.type === 'group' ? clipboard.value.data : [clipboard.value.data]
        try {
          // Calculate offset from cell time to shift all pasted windows
          const cellMins = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1])
          const firstW = pasteWindows[0]
          const firstMins = parseInt(firstW.startTime.split(':')[0]) * 60 + parseInt(firstW.startTime.split(':')[1])
          const offsetMins = cellMins - firstMins

          const createData = pasteWindows.map(w => {
            const wStartMins = parseInt(w.startTime.split(':')[0]) * 60 + parseInt(w.startTime.split(':')[1])
            const wEndMins = parseInt(w.endTime.split(':')[0]) * 60 + parseInt(w.endTime.split(':')[1])
            const newStart = Math.max(0, Math.min(wStartMins + offsetMins, 1439))
            const newEnd = Math.max(newStart + 30, Math.min(wEndMins + offsetMins, 1440))
            return {
              specialistId: w.specialistId,
              applicationId: w.applicationId,
              startTime: fmtTimeFromMins(newStart),
              endTime: fmtTimeFromMins(newEnd),
              scheduledDate: date,
              inheritsOnReopen: w.inheritsOnReopen || false,
              affinityWeight: w.affinityWeight ?? null,
            }
          })
          await calStore.createWindows(createData)
          if (clipboard.value.cut) {
            const cutIds = pasteWindows.map(w => w.id).filter(Boolean)
            if (cutIds.length > 0) await calStore.batchDelete(cutIds)
            cutWindowIds.value = new Set()
            clipboard.value = null
          }
          showToast(createData.length === 1 ? 'Ventana pegada.' : `${createData.length} ventanas pegadas.`)
        } catch (e) {
          showToast(e.userMessage || 'Error al pegar.', 'error')
        }
        break
    }
  }
}

// Toast
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')
const showToast = (msg, type = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
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
    const created = await calStore.createWindows(data)
    mostrarCrear.value = false
    prefillData.value = null
    const n = created.length
    showToast(n === 1 ? 'Ventana de trabajo creada.' : `${n} ventanas de trabajo creadas.`)
  } catch (e) {
    errorCrear.value = e.userMessage || 'Error al crear la ventana.'
  } finally {
    creando.value = false
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
    await calStore.deleteWindow(w.id)
    selectedWindow.value = null
    removeFromGroup(w.id)
    showToast('Ventana eliminada.')
  } catch (e) {
    showToast(e.userMessage || 'Error al eliminar ventana.', 'error')
  } finally {
    modalLoading.value = false
  }
}

// ---- Toggle habilitar/inhabilitar ----
const handleToggle = async (w) => {
  try {
    const updated = await calStore.toggleWindow(w)
    if (selectedWindow.value?.id === w.id) selectedWindow.value = updated
    syncGroupWindow(updated)
    showToast(updated.isActive ? 'Ventana habilitada.' : 'Ventana inhabilitada.')
  } catch (e) {
    showToast(e.userMessage || 'Error al cambiar estado.', 'error')
  }
}

// ---- Herencia: desactivar / activar ----
const handleDisinherit = async (w) => {
  try {
    const updated = await calStore.disinheritWindow(w)
    if (selectedWindow.value?.id === w.id) selectedWindow.value = updated
    syncGroupWindow(updated)
    showToast('Herencia desactivada.')
  } catch (e) {
    showToast(e.userMessage || 'Error al desactivar herencia.', 'error')
  }
}

const handleReinherit = async (w) => {
  try {
    const newWindow = await calStore.reinheritWindow(w)
    if (selectedWindow.value?.id === w.id) selectedWindow.value = newWindow
    syncGroupWindow(newWindow)
    showToast('Herencia activada.')
  } catch (e) {
    showToast(e.userMessage || 'Error al activar herencia.', 'error')
  }
}

// ---- Eliminar grupo completo ----
const handleDeleteGroup = async (group) => {
  modalLoading.value = true
  try {
    await calStore.deleteGroup(group)
    selectedGroup.value = null
    showToast(`${group.windows.length} ventanas eliminadas.`)
  } catch (e) {
    showToast(e.userMessage || 'Error al eliminar el grupo.', 'error')
  } finally {
    modalLoading.value = false
  }
}

// ---- Actualizar ventana (edición de horario) ----
const handleUpdate = async (w, payload) => {
  modalLoading.value = true
  try {
    const updated = await calStore.updateWindow(w, payload)
    selectedWindow.value = updated
    openModalInEdit.value = false
    showToast('Horario actualizado.')
  } catch (e) {
    showToast(e.userMessage || 'Error al actualizar la ventana.', 'error')
  } finally {
    modalLoading.value = false
  }
}

// ---- Eraser tool ----
const handleErase = async ({ dates, startTime, endTime }) => {
  try {
    await calStore.eraseRange(dates, startTime, endTime)
    showToast('Rango borrado.')
  } catch (e) {
    showToast(e.userMessage || 'Error al borrar el rango.', 'error')
  }
}

// ---- Batch actions (selection tool) ----
const handleBatchDelete = async () => {
  if (selectedWindows.value.size === 0) return
  try {
    await calStore.batchDelete([...selectedWindows.value])
    showToast(`${selectedWindows.value.size} ventana(s) eliminada(s).`)
    selectedWindows.value = new Set()
  } catch (e) {
    showToast(e.userMessage || 'Error al eliminar.', 'error')
  }
}

const handleBatchToggle = async () => {
  if (selectedWindows.value.size === 0) return
  try {
    await calStore.batchToggle([...selectedWindows.value])
    showToast(`${selectedWindows.value.size} ventana(s) actualizada(s).`)
    selectedWindows.value = new Set()
  } catch (e) {
    showToast(e.userMessage || 'Error al cambiar estado.', 'error')
  }
}

const handleBatchCopy = () => {
  if (selectedWindows.value.size === 0) return
  const wins = calStore.windows.filter(w => selectedWindows.value.has(w.id))
  clipboard.value = { type: 'group', data: wins, cut: false }
  showToast(`${wins.length} ventana(s) copiada(s).`)
}

const handleBatchGroup = async () => {
  if (selectedWindows.value.size < 2) {
    showToast('Selecciona al menos 2 ventanas para agrupar.', 'error')
    return
  }

  // Validate merge rules before sending to backend
  const now = new Date()
  const wins = calStore.windows.filter(w => selectedWindows.value.has(w.id))

  // Rule: no ended windows (ends_at < now)
  const ended = wins.filter(w => w.endsAt && new Date(w.endsAt) < now)
  if (ended.length > 0) {
    showToast(`No se puede agrupar: ${ended.length} ventana(s) ya finalizaron.`, 'error')
    return
  }

  // Rule: only the earliest window (MIN starts_at) can be in-shift
  const inShift = wins.filter(w => w.startsAt && new Date(w.startsAt) <= now && w.endsAt && new Date(w.endsAt) >= now && w.isActive)
  if (inShift.length > 1) {
    showToast('No se puede agrupar: más de una ventana está en turno.', 'error')
    return
  }
  if (inShift.length === 1) {
    const earliest = wins.reduce((a, b) => new Date(a.startsAt) < new Date(b.startsAt) ? a : b)
    if (inShift[0].id !== earliest.id) {
      showToast('Solo la ventana más temprana puede estar en turno al agrupar.', 'error')
      return
    }
  }

  try {
    const result = await calStore.batchMerge(selectedWindows.value)
    const label = result.mode === 'homogeneous'
      ? `${result.deletedIds.length + 1} ventanas fusionadas en 1.`
      : `${result.windows.length} ventanas sincronizadas.`
    showToast(label)
    selectedWindows.value = new Set()
  } catch (e) {
    showToast(e.userMessage || 'Error al agrupar las ventanas.', 'error')
  }
}

// ---- Resize (drag edge to stretch) ----
const handleResize = async (data) => {
  try {
    await calStore.resizeWindow(data)
    showToast('Horario actualizado.')
  } catch (e) {
    showToast(e.userMessage || 'Error al redimensionar la ventana.', 'error')
  }
}

// ---- Horizontal expand (stretch across days) ----
const handleHorizontalExpand = async ({ window: w, direction, dates }) => {
  try {
    await calStore.horizontalExpand(w, direction, dates)
    showToast(`${dates.length} ventana${dates.length > 1 ? 's' : ''} creada${dates.length > 1 ? 's' : ''}.`)
  } catch (e) {
    showToast(e.userMessage || 'Error al expandir la ventana.', 'error')
  }
}

// ---- Reschedule (drag-to-move) ----
const handleReschedule = async (data) => {
  try {
    await calStore.rescheduleWindow(data)
    showToast('Ventana movida.')
  } catch (e) {
    showToast(e.userMessage || 'Error al mover la ventana.', 'error')
  }
}


// ---- Batch resize (selection mode) ----
const handleBatchResize = async ({ ids, direction, deltaSlots }) => {
  try {
    await calStore.batchResize(ids, direction, deltaSlots)
    showToast(`${ids.length} ventanas redimensionadas.`)
  } catch (e) {
    showToast(e.userMessage || 'Error al redimensionar.', 'error')
  }
}

// ---- Group resize ----
const handleGroupResize = async (data) => {
  try {
    await calStore.resizeGroup(data)
    showToast('Grupo actualizado.')
  } catch (e) {
    showToast(e.userMessage || 'Error al redimensionar el grupo.', 'error')
  }
}

// ---- Group reschedule ----
const handleGroupReschedule = async (data) => {
  try {
    await calStore.rescheduleGroup(data)
    showToast('Grupo movido.')
  } catch (e) {
    showToast(e.userMessage || 'Error al mover el grupo.', 'error')
  }
}

// ---- Batch reschedule (drag selected windows) ----
const handleBatchReschedule = async ({ ids, targetDate, deltaHours }) => {
  try {
    // Compute numeric deltaDays from targetDate and the first window's date
    const firstWin = calStore.windows.find(w => ids.includes(w.id))
    const origDate = new Date(firstWin.scheduledDate + 'T00:00:00')
    const destDate = new Date(targetDate + 'T00:00:00')
    const deltaDays = Math.round((destDate - origDate) / 86400000)
    await calStore.batchReschedule(ids, deltaDays, deltaHours)
    showToast('Ventanas movidas.')
  } catch (e) {
    showToast(e.userMessage || 'Error al mover las ventanas.', 'error')
  }
}

// ---- Group panel: select individual from group ----
const returnToGroup = ref(null)

const onGroupSelect = (w) => {
  returnToGroup.value = selectedGroup.value
  selectedGroup.value = null
  openModalInEdit.value = false
  selectedWindow.value = w
}

const closeWindowModal = () => {
  selectedWindow.value = null
  openModalInEdit.value = false
  if (returnToGroup.value) {
    selectedGroup.value = returnToGroup.value
    returnToGroup.value = null
  }
}

// ---- Resize listener ----
function onResize() { calStore.updateMobile(window.innerWidth < BP_MOBILE) }

// ---- Keyboard shortcuts ----
const onKeydown = (e) => {
  // Ctrl+Z: undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (calStore.canUndo) {
      calStore.undo()
        .then(() => showToast('Acción deshecha.'))
        .catch(() => showToast('Error al deshacer.', 'error'))
    }
    return
  }
  // Escape
  if (e.key === 'Escape') {
    if (cutWindowIds.value.size > 0) { cutWindowIds.value = new Set(); clipboard.value = null; return }
    if (selectedWindows.value.size > 0) { selectedWindows.value = new Set(); return }
    if (activeTool.value !== 'default') { setTool('default'); return }
    if (selectedWindow.value) selectedWindow.value = null
    else if (mostrarCrear.value) { mostrarCrear.value = false; prefillData.value = null; errorCrear.value = '' }
  }
  // Delete/Supr: eliminar ventanas seleccionadas o la ventana activa
  if (e.key === 'Delete') {
    if (selectedWindows.value.size > 0) { handleBatchDelete(); return }
    if (selectedWindow.value) { handleDelete(selectedWindow.value); return }
  }
}

onMounted(() => {
  calStore.loadWindows()
  userStore.loadUsers()
  userStore.loadSelects()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  window.addEventListener('click', closeCtxMenu)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('click', closeCtxMenu)
})
</script>

<template>
  <section class="content" :class="{ 'content--with-fab': authStore.isAdmin && isMobile }">
    <Teleport to="#topbar-actions" defer>
      <button v-if="authStore.isAdmin && !isMobile" @click="openCreatePanel" class="btn-create">
        <i class='bx bx-plus'></i>
        <span class="btn-create__label">Nueva Ventana</span>
        <span class="btn-create__short">Nueva</span>
      </button>
    </Teleport>

    <!-- Toolbar -->
    <div class="toolbar">
      <!-- Row 1: nav + label -->
      <div class="toolbar__row">
        <button class="toolbar__arrow" @click="slideDir = 'slide-right'; calStore.prevNav()">
          <i class='bx bx-chevron-left'></i>
        </button>
        <button class="toolbar__today" @click="slideDir = ''; calStore.goToday()" :class="{ 'toolbar__today--hidden-mobile': isMobile }">Hoy</button>
        <button class="toolbar__arrow" @click="slideDir = 'slide-left'; calStore.nextNav()">
          <i class='bx bx-chevron-right'></i>
        </button>
        <button class="toolbar__date-btn" @click="openDatePicker">
          <span class="toolbar__date-text">{{ weekLabel }}</span>
          <i class='bx bx-calendar'></i>
        </button>
        <input ref="datePickerRef" type="date" class="toolbar__date-picker" @change="onDatePicked" />

        <!-- View toggle (siempre visible) -->
        <div class="toolbar__views">
          <button class="toolbar__view-btn" :class="{ 'toolbar__view-btn--active': calView === 'day' }"
            @click="calView = 'day'">Día</button>
          <button class="toolbar__view-btn" :class="{ 'toolbar__view-btn--active': calView === 'week' }"
            @click="calView = 'week'"><span class="toolbar__view-full">Semana</span><span class="toolbar__view-short">Sem</span></button>
          <button class="toolbar__view-btn" :class="{ 'toolbar__view-btn--active': calView === 'month' }"
            @click="calView = 'month'">Mes</button>
        </div>

        <!-- Tool toggle (admin only, hidden on mobile via CSS) -->
        <div v-if="authStore.isAdmin" class="toolbar__tools">
          <button class="toolbar__tool-btn" :class="{ 'toolbar__tool-btn--active': activeTool === 'default' }"
            @click="setTool('default')" title="Modo normal">
            <i class='bx bx-pointer'></i>
          </button>
          <button class="toolbar__tool-btn" :class="{ 'toolbar__tool-btn--active': activeTool === 'eraser' }"
            @click="setTool('eraser')" title="Borrador">
            <i class='bx bx-eraser'></i>
          </button>
          <button class="toolbar__tool-btn" :class="{ 'toolbar__tool-btn--active': activeTool === 'select' }"
            @click="setTool('select')" title="Seleccionar">
            <i class='bx bx-select-multiple'></i>
          </button>
        </div>

        <!-- Undo button (hidden on mobile via CSS) -->
        <button v-if="authStore.isAdmin" class="toolbar__undo-btn" :disabled="!canUndo"
          @click="calStore.undo().then(() => showToast('Acción deshecha.')).catch(() => showToast('Error al deshacer.', 'error'))"
          title="Deshacer (Ctrl+Z)">
          <i class='bx bx-undo'></i>
        </button>

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
            <span class="toolbar__dot toolbar__dot--open"></span>Activa
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
        <div v-if="authStore.isAdmin" class="toolbar__tools toolbar__tools--mobile">
          <button class="toolbar__tool-btn" :class="{ 'toolbar__tool-btn--active': activeTool === 'default' }"
            @click="setTool('default')" title="Modo normal">
            <i class='bx bx-pointer'></i>
          </button>
          <button class="toolbar__tool-btn" :class="{ 'toolbar__tool-btn--active': activeTool === 'eraser' }"
            @click="setTool('eraser')" title="Borrador">
            <i class='bx bx-eraser'></i>
          </button>
          <button class="toolbar__tool-btn" :class="{ 'toolbar__tool-btn--active': activeTool === 'select' }"
            @click="setTool('select')" title="Seleccionar">
            <i class='bx bx-select-multiple'></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Month strip (mobile only, month view) -->
    <div v-if="isMobile && calView === 'month'" class="month-strip">
      <button
        v-for="m in monthStripItems"
        :key="m.offset"
        class="month-strip__item"
        :class="{ 'month-strip__item--active': m.offset === monthOffset }"
        @click="slideDir = m.offset > monthOffset ? 'slide-left' : 'slide-right'; monthOffset = m.offset"
      >{{ m.label }}</button>
    </div>

    <!-- Calendar area (isolated block to prevent vnode patching conflicts) -->
    <div class="cal-area">
      <!-- Loading -->
      <SectionLoader v-if="loading" message="Cargando ventanas de trabajo..." />

      <!-- Calendario -->
      <WeekCalendar v-else :windows="windowsFiltradas" :week-dates="weekDates" :specialists="userStore.users"
        :applications="userStore.applications" :selectable="authStore.isAdmin" :is-mobile="isMobile" :view-mode="calView"
        :month-dates="monthDates" :current-month="currentMonth" :active-tool="activeTool"
        :selected-window-ids="selectedWindows" :cut-window-ids="cutWindowIds" :slide-dir="slideDir"
        @select="selectedWindow = $event"
        @group-select="selectedGroup = $event" @range-selected="onRangeSelected" @reschedule="handleReschedule"
        @group-reschedule="handleGroupReschedule" @batch-reschedule="handleBatchReschedule" @group-resize="handleGroupResize"
        @next-day="slideDir = 'slide-left'; calStore.nextDay()" @prev-day="slideDir = 'slide-right'; calStore.prevDay()"
        @next-week="slideDir = 'slide-left'; calStore.nextNav()" @prev-week="slideDir = 'slide-right'; calStore.prevNav()"
        @next-month="slideDir = 'slide-left'; calStore.nextNav()" @prev-month="slideDir = 'slide-right'; calStore.prevNav()"
        @resize="handleResize" @batch-resize="handleBatchResize" @horizontal-expand="handleHorizontalExpand" @select-day="calStore.selectDay"
        @erase="handleErase" @selection-change="onSelectionChange"
        @context-window="onWindowContext" @context-group="onGroupContext" @context-cell="onCellContext" />
    </div>

    <!-- Modal detalle -->
    <WorkWindowModal v-if="selectedWindow" :window="selectedWindow" :specialist-name="calStore.specName(selectedWindow)"
      :application-name="calStore.appName(selectedWindow)" :loading="modalLoading"
      :start-in-edit-mode="openModalInEdit"
      :show-back-button="!!returnToGroup"
      @close="closeWindowModal" @back="closeWindowModal"
      @delete="handleDelete" @update="handleUpdate" @toggle="handleToggle"
      @disinherit="handleDisinherit" @reinherit="handleReinherit" />

    <!-- Panel grupo -->
    <WindowGroupPanel v-if="selectedGroup" :group="selectedGroup" :specialists="userStore.users"
      :applications="userStore.applications" :all-windows="calStore.windows" :loading="modalLoading" :cut-window-ids="cutWindowIds"
      @close="selectedGroup = null"
      @select="onGroupSelect" @delete="handleDelete"
      @delete-group="handleDeleteGroup" @toggle="handleToggle"
      @copy="(w) => { clipboard = { type: 'window', data: w, cut: false }; showToast('Ventana copiada.') }"
      @cut="(w) => { clipboard = { type: 'window', data: w, cut: true }; cutWindowIds = new Set([w.id]); showToast('Ventana cortada.') }"
      @disinherit="handleDisinherit" @reinherit="handleReinherit" />

    <!-- Modal crear -->
    <CreateWorkWindowModal :visible="mostrarCrear" :creating="creando" :error="errorCrear"
      :specialists="specialistsConVentana" :applications="userStore.applications" :prefill="prefillData"
      @close="mostrarCrear = false; errorCrear = ''; prefillData = null" @create="handleCreate" />

    <!-- Mobile FAB -->
    <button v-if="authStore.isAdmin && isMobile" class="btn-fab" @click="openCreatePanel">
      <i class='bx bx-plus'></i>
    </button>

    <!-- Selection action bar -->
    <Teleport to="body">
      <div v-if="selectedWindows.size > 0" class="sel-bar">
        <span class="sel-bar__count">{{ selectedWindows.size }} seleccionada{{ selectedWindows.size > 1 ? 's' : '' }}</span>
        <button class="sel-bar__btn" @click="handleBatchCopy" title="Copiar">
          <i class='bx bx-copy'></i>
        </button>
        <button class="sel-bar__btn" @click="handleBatchToggle" title="Habilitar/Inhabilitar">
          <i class='bx bx-toggle-left'></i>
        </button>
        <button class="sel-bar__btn sel-bar__btn--group" @click="handleBatchGroup" title="Agrupar ventanas">
          <i class='bx bx-group'></i>
        </button>
        <button class="sel-bar__btn sel-bar__btn--danger" @click="handleBatchDelete" title="Eliminar">
          <i class='bx bx-trash'></i>
        </button>
        <button class="sel-bar__btn" @click="selectedWindows = new Set()" title="Limpiar selección">
          <i class='bx bx-x'></i>
        </button>
      </div>
    </Teleport>

    <ToastNotification :visible="toastVisible" :message="toastMessage" :type="toastType"
      @close="toastVisible = false" />

    <ContextMenu :visible="ctxMenu.visible" :x="ctxMenu.x" :y="ctxMenu.y" :items="ctxMenu.items"
      @select="handleCtxAction" @close="closeCtxMenu" />
  </section>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.cal-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.toolbar__date-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.55rem;
  background: var(--bg-main);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
  margin-right: auto;
  transition: all 0.15s;
  min-width: 0;
}

.toolbar__date-btn:hover {
  border-color: var(--primary-500);
  background: rgba(42, 199, 143, 0.06);
}

.toolbar__date-btn:hover i {
  color: var(--primary-500);
}

.toolbar__date-text {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.toolbar__date-btn i {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: color 0.15s;
}

.toolbar__date-picker {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
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

.toolbar__view-short { display: none; }
.toolbar__view-full { display: inline; }

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

/* Tool toggle */
.toolbar__tools {
  display: flex;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  margin-left: 0.25rem;
}

.toolbar__tool-btn {
  padding: 0.2rem 0.4rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  background: var(--bg-main);
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
}

.toolbar__tool-btn+.toolbar__tool-btn {
  border-left: 1px solid var(--border-light);
}

.toolbar__tool-btn:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.toolbar__tool-btn--active {
  background: var(--primary-500);
  color: white;
}

.toolbar__tool-btn--active:hover {
  background: var(--primary-600);
  color: white;
}

/* Undo button */
.toolbar__undo-btn {
  padding: 0.2rem 0.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: none;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 0.15rem;
}

.toolbar__undo-btn:not(:disabled):hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
}

.toolbar__undo-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* Selection action bar */
.sel-bar {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-card, #1e2030);
  border: 1px solid var(--border-light, #2a2d3e);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 300;
}

.sel-bar__count {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  white-space: nowrap;
}

.sel-bar__btn {
  padding: 0.3rem 0.4rem;
  border: 1px solid var(--border-light, #2a2d3e);
  border-radius: var(--radius-sm, 4px);
  background: none;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}

.sel-bar__btn:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
}

.sel-bar__btn--danger:hover {
  color: #ef4444;
  border-color: #ef4444;
}

.sel-bar__btn--group:hover {
  color: #8b5cf6;
  border-color: #8b5cf6;
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

.toolbar__tools--mobile {
  align-self: flex-start;
}

/* ---- Month strip ---- */
.month-strip {
  display: flex;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--bg-main);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  scroll-snap-type: x mandatory;
  flex-shrink: 0;
}

.month-strip::-webkit-scrollbar { display: none; }

.month-strip__item {
  flex: 1;
  flex-shrink: 0;
  padding: 0.3rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  scroll-snap-align: center;
  transition: all 0.15s;
  text-align: center;
}

.month-strip__item:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.month-strip__item--active {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-500);
}

.month-strip__item--active:hover {
  background: var(--primary-600);
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

  .toolbar {
    padding: 0.35rem 0.4rem;
  }

  .toolbar__today--hidden-mobile {
    display: none;
  }

  .toolbar__view-short { display: inline; }
  .toolbar__view-full { display: none; }

  .toolbar__date-text {
    font-size: 0.72rem;
  }

  .toolbar__date-btn {
    padding: 0.2rem 0.4rem;
    gap: 0.3rem;
  }

  .toolbar__tools:not(.toolbar__tools--mobile) {
    display: none;
  }
  .toolbar__undo-btn {
    display: none;
  }

  .content--with-fab .cal-area {
    padding-bottom: 5rem;
  }
}

/* Small phone (375px and below) */
@media (max-width: 390px) {
  .toolbar {
    padding: 0.3rem;
  }

  .toolbar__row {
    gap: 0.2rem;
    flex-wrap: wrap;
  }

  .toolbar__date-btn {
    order: -1;
    flex-basis: 100%;
  }

  .toolbar__arrow {
    padding: 0.15rem 0.25rem;
    font-size: 0.9rem;
  }

  .toolbar__today {
    padding: 0.15rem 0.35rem;
    font-size: 0.65rem;
  }

  .toolbar__date-text {
    font-size: 0.65rem;
  }

  .toolbar__date-btn {
    padding: 0.15rem 0.3rem;
    gap: 0.25rem;
  }

  .toolbar__date-btn i {
    font-size: 0.75rem;
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

/* Mobile sel-bar: above FAB, edge-to-edge */
@media (max-width: 768px) {
  .sel-bar {
    bottom: 5rem;
    left: 1rem;
    right: 1rem;
    transform: none;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.6rem;
  }
  .sel-bar__count {
    width: 100%;
    text-align: center;
  }
}
</style>

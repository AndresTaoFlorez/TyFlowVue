<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { findGroupForWindow } from '@/presentation/composables/useWindowGroups'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCalendarStore } from '@/presentation/stores/useCalendarStore'
import WeekCalendar from '@/presentation/components/calendar/WeekCalendar.vue'
import WorkWindowModal from '@/presentation/components/calendar/WorkWindowModal.vue'
import CreateWorkWindowModal from '@/presentation/components/calendar/CreateWorkWindowModal.vue'
import BulkAssignModal from '@/presentation/components/calendar/BulkAssignModal.vue'
import WindowGroupPanel from '@/presentation/components/calendar/WindowGroupPanel.vue'
import CalSidebar from '@/presentation/components/calendar/CalSidebar.vue'
import TopbarBoard from '@/presentation/components/layout/TopbarBoard.vue'
import SidebarBoard from '@/presentation/components/layout/SidebarBoard.vue'
import { fmtHM, fmtTimeFromMins } from '@/presentation/helpers/formatTime'
import SectionLoader from '@/presentation/components/layout/SectionLoader.vue'
import ToastNotification from '@/presentation/components/layout/ToastNotification.vue'
import ContextMenu from '@/presentation/components/shared/ContextMenu.vue'
import { BP_MOBILE } from '@/presentation/utils/breakpoints'
import { useCalendarRealtime } from '@/presentation/composables/useCalendarRealtime'

const authStore = useAuthStore()
const userStore = useUserStore()
const calStore = useCalendarStore()
const route = useRoute()
const router = useRouter()

useCalendarRealtime()

const {
  calView, weekDates, monthDates, currentMonth, weekLabel,
  loading, windowsFiltradas, monthOffset,
  specialistsConVentana,
  isMobile, canUndo, density,
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
const mostrarBulk = ref(false)
const creando = ref(false)
const errorCrear = ref('')
const prefillData = ref(null)
const modalLoading = ref(false)
const selectedGroup = ref(null)
const showMobileFilters = ref(false)
const slideDir = ref('') // 'slide-left' | 'slide-right'

// ---- View dropdown (Día / 5 días / Semana / Mes / Agenda) ----
const VIEW_OPTIONS = [
  { key: 'day', label: 'Día' },
  { key: '5days', label: '5 días', disabled: true },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'agenda', label: 'Agenda', disabled: true },
]
const viewMenuOpen = ref(false)
const viewDdRef = ref(null)
const viewLabel = computed(() => VIEW_OPTIONS.find(v => v.key === calView.value)?.label || 'Semana')
function toggleViewMenu() { viewMenuOpen.value = !viewMenuOpen.value }
function selectView(opt) {
  if (opt.disabled) return
  calView.value = opt.key
  viewMenuOpen.value = false
}
function onViewDdDocClick(e) {
  if (viewMenuOpen.value && viewDdRef.value && !viewDdRef.value.contains(e.target)) {
    viewMenuOpen.value = false
  }
}

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

function nextGridSlotMins() {
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  return Math.ceil((mins + 1) / 30) * 30
}

function todayISOLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function pasteOnSlot(date, startTime, endTime) {
  if (!clipboard.value) return
  const pasteWindows = clipboard.value.type === 'group' ? clipboard.value.data : [clipboard.value.data]

  const [tH, tM] = startTime.split(':').map(Number)
  let targetStartMins = tH * 60 + tM

  if (date === todayISOLocal()) {
    const nextSlot = nextGridSlotMins()
    if (targetStartMins < nextSlot) targetStartMins = nextSlot
  }

  const fw = pasteWindows[0]
  const [fH, fM] = fw.startTime.split(':').map(Number)
  const offsetMins = targetStartMins - (fH * 60 + fM)

  try {
    const createData = pasteWindows.map(w => {
      const [wSH, wSM] = w.startTime.split(':').map(Number)
      const [wEH, wEM] = w.endTime.split(':').map(Number)
      const dur = (wEH * 60 + wEM) - (wSH * 60 + wSM)
      const newStart = Math.max(0, Math.min(wSH * 60 + wSM + offsetMins, 1410))
      const newEnd = Math.max(newStart + 30, Math.min(newStart + dur, 1440))
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
    if (clipboard.value?.cut) {
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
  // Seal rules per API_CONTRACT Section 16:
  // Future (starts_at > now): full edit, delete, merge, inherit
  // In-progress (starts_at <= now <= ends_at): toggle only
  // Ended (ends_at < now): read-only
  const now = new Date()
  const isFuture = w.startsAt && new Date(w.startsAt) > now
  const isEnded = w.endsAt && new Date(w.endsAt) < now
  const isInProgress = !isFuture && !isEnded
  const hasInheritance = !!(w.inheritedFromWindowId || w.inheritsOnReopen)
  const inheritItem = isFuture
    ? (hasInheritance
      ? { label: 'Desactivar herencia', icon: 'bx-unlink', action: 'disinherit' }
      : { label: 'Activar herencia', icon: 'bx-link', action: 'reinherit' })
    : null
  const items = [
    // Edit: futuras = todo; en turno = solo el fin (sellado en dos niveles §4)
    ...(isFuture ? [{ label: 'Editar', icon: 'bx-pencil', action: 'edit' }] : []),
    ...(!isFuture && !isEnded ? [{ label: 'Ajustar fin', icon: 'bx-pencil', action: 'edit' }] : []),
    ...(isFuture ? [{ label: 'Agregar especialista', icon: 'bx-user-plus', action: 'add-specialist' }] : []),
    // Toggle: allowed on future and in-progress, NOT ended
    ...(!isEnded ? [{ label: w.isActive ? 'Inhabilitar' : 'Habilitar', icon: w.isActive ? 'bx-block' : 'bx-check-circle', action: 'toggle' }] : []),
    ...(inheritItem ? [inheritItem] : []),
    { label: 'Copiar ventana', icon: 'bx-copy', action: 'copy' },
    // Cut: only future (will be deleted after paste)
    ...(isFuture ? [{ label: 'Cortar ventana', icon: 'bx-cut', action: 'cut' }] : []),
    ...(clipboard.value ? [{ label: 'Pegar aquí', icon: 'bx-paste', action: 'paste-on-window' }] : []),
    { label: 'Copiar ID', icon: 'bx-hash', action: 'copy-id' },
    // Delete: only future (sealed windows rejected by DB)
    ...(isFuture ? [{ label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true }] : []),
  ]
  ctxMenu.value = { visible: true, x, y, items, target: w, targetType: 'window' }
}

function onGroupContext({ group, x, y }) {
  const now = new Date()
  const allGroupFuture = group.windows.every(w => w.startsAt && new Date(w.startsAt) > now)
  const allGroupEnded = group.windows.every(w => w.endsAt && new Date(w.endsAt) < now)
  const items = [
    { label: 'Ver grupo', icon: 'bx-expand-alt', action: 'view-group' },
    ...(allGroupFuture ? [{ label: 'Agregar especialista', icon: 'bx-user-plus', action: 'add-to-group' }] : []),
    { label: 'Copiar grupo', icon: 'bx-copy', action: 'copy-group' },
    ...(allGroupFuture ? [{ label: 'Cortar grupo', icon: 'bx-cut', action: 'cut-group' }] : []),
    ...(clipboard.value ? [{ label: 'Pegar aquí', icon: 'bx-paste', action: 'paste-on-group' }] : []),
    // Delete group: only if all future
    ...(allGroupFuture ? [{ label: 'Eliminar grupo', icon: 'bx-trash', action: 'delete-group', danger: true }] : []),
  ]
  ctxMenu.value = { visible: true, x, y, items, target: group, targetType: 'group' }
}

function onCellContext({ date, time, x, y }) {
  const isPast = date < todayISOLocal() || (date === todayISOLocal() && (() => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m + 60 <= nextGridSlotMins()
  })())
  const items = [
    ...(!isPast ? [{ label: 'Crear ventana', icon: 'bx-plus', action: 'create' }] : []),
    ...(clipboard.value && !isPast ? [{ label: 'Pegar ventana', icon: 'bx-paste', action: 'paste' }] : []),
  ]
  if (items.length === 0) return // nothing to show
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
        const startMins = Math.floor(group.startHour) * 60 + Math.round((group.startHour % 1) * 60)
        const endMins = Math.floor(group.endHour) * 60 + Math.round((group.endHour % 1) * 60)
        const dur = endMins - startMins
        let adjustedStart = startMins
        if (firstW.scheduledDate === todayISOLocal() && startMins < nextGridSlotMins()) {
          adjustedStart = nextGridSlotMins()
        }
        const adjustedEnd = Math.min(adjustedStart + dur, 1440)
        prefillData.value = {
          dates: [firstW.scheduledDate],
          startTime: fmtTimeFromMins(adjustedStart),
          endTime: fmtTimeFromMins(adjustedEnd),
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
      case 'paste': {
        if (!clipboard.value) break
        const pasteWindows = clipboard.value.type === 'group' ? clipboard.value.data : [clipboard.value.data]
        try {
          let cellMins = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1])
          if (date === todayISOLocal() && cellMins < nextGridSlotMins()) {
            cellMins = nextGridSlotMins()
          }
          const firstW = pasteWindows[0]
          const firstMins = parseInt(firstW.startTime.split(':')[0]) * 60 + parseInt(firstW.startTime.split(':')[1])
          const offsetMins = cellMins - firstMins

          const createData = pasteWindows.map(w => {
            const wStartMins = parseInt(w.startTime.split(':')[0]) * 60 + parseInt(w.startTime.split(':')[1])
            const wEndMins = parseInt(w.endTime.split(':')[0]) * 60 + parseInt(w.endTime.split(':')[1])
            const dur = wEndMins - wStartMins
            const newStart = Math.max(0, Math.min(wStartMins + offsetMins, 1410))
            const newEnd = Math.max(newStart + 30, Math.min(newStart + dur, 1440))
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
          if (clipboard.value?.cut) {
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
  // Block creation if the entire range is in the past
  const date = range.days?.[range.days.length - 1]?.date || range.date
  if (date && date < todayISOLocal()) {
    showToast('No se pueden crear ventanas en fechas pasadas.', 'error')
    return
  }
  if (date === todayISOLocal()) {
    const endMins = Math.floor(range.endHour) * 60 + Math.round((range.endHour % 1) * 60)
    if (endMins <= nextGridSlotMins() - 30) {
      showToast('No se pueden crear ventanas en horarios pasados.', 'error')
      return
    }
  }
  // El inicio no puede ser anterior a la línea de tiempo (now).
  const startDate = range.days?.[0]?.date || range.date
  if (startDate === todayISOLocal()) {
    const startMins = Math.floor(range.startHour) * 60 + Math.round((range.startHour % 1) * 60)
    const now = new Date()
    if (startMins < now.getHours() * 60 + now.getMinutes()) {
      showToast('No se puede crear una ventana que inicie en el pasado.', 'error')
      return
    }
  }
  prefillData.value = range
  mostrarCrear.value = true
}

const openCreatePanel = () => {
  prefillData.value = null
  mostrarCrear.value = true
}

// Crear desde el sidebar interno (CalSidebar → store seam): 'single' abre el
// modal de ventana individual, 'bulk' el de asignación masiva.
watch(() => calStore.createRequest, (req) => {
  if (!req) return
  if (req.mode === 'bulk') {
    errorCrear.value = ''
    mostrarBulk.value = true
  } else {
    openCreatePanel()
  }
})

// ---- Crear ventanas ----
const handleCreate = async (data) => {
  creando.value = true
  errorCrear.value = ''
  try {
    const created = await calStore.createWindows(data)
    mostrarCrear.value = false
    mostrarBulk.value = false
    prefillData.value = null
    const n = created.length
    showToast(n === 1 ? 'Ventana de trabajo creada.' : `${n} ventanas de trabajo creadas.`)
  } catch (e) {
    errorCrear.value = e.userMessage || 'Error al crear la ventana.'
  } finally {
    creando.value = false
  }
}

// ---- Crear series recurrentes (asignación masiva) ----
const handleCreateRecurring = async ({ combos, dates, startTime, endTime, affinityWeight }) => {
  creando.value = true
  errorCrear.value = ''
  try {
    const created = await calStore.createRecurringWindows(combos, dates, startTime, endTime, affinityWeight)
    mostrarBulk.value = false
    showToast(created.length === 1 ? 'Ventana de trabajo creada.' : `${created.length} ventanas de trabajo creadas.`)
  } catch (e) {
    errorCrear.value = e.userMessage || 'Error al crear las ventanas.'
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

// ---- Habilitar/inhabilitar el grupo en lote (desde el modal de grupo) ----
const handleToggleGroup = async (targets) => {
  modalLoading.value = true
  try {
    await calStore.batchToggle(targets.map(w => w.id))
    // Refrescar las ventanas del grupo abierto con el estado nuevo del store
    for (const w of targets) {
      const updated = calStore.windows.find(x => x.id === w.id)
      if (updated) syncGroupWindow(updated)
    }
    showToast(`${targets.length} ventana(s) actualizada(s).`)
  } catch (e) {
    showToast(e.userMessage || 'Error al cambiar estado.', 'error')
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
    // batchDelete excluye selladas (no eliminables) y devuelve cuántas borró
    const deleted = await calStore.batchDelete([...selectedWindows.value])
    const skipped = selectedWindows.value.size - deleted
    showToast(skipped > 0
      ? `${deleted} eliminada(s); ${skipped} ya iniciaron y no se pueden eliminar.`
      : `${deleted} ventana(s) eliminada(s).`)
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

// ---- Herencia en lote (toggle inteligente sobre la selección) ----
const selectedWindowObjs = computed(() =>
  calStore.windows.filter(w => selectedWindows.value.has(w.id))
)

// Una ventana hereda si proviene de otra o se re-hereda al reabrir.
const selectedAllInherit = computed(() => {
  const wins = selectedWindowObjs.value
  return wins.length > 0 && wins.every(w => !!(w.inheritedFromWindowId || w.inheritsOnReopen))
})

const handleBatchInheritToggle = async () => {
  if (selectedWindows.value.size === 0) return
  const ids = selectedWindowObjs.value.map(w => w.id)
  // Si TODAS las seleccionadas ya heredan → desactivar; si no → activar.
  const desactivar = selectedAllInherit.value
  try {
    const { successCount, failedCount } = desactivar
      ? await calStore.batchDisinherit(ids)
      : await calStore.batchInherit(ids)
    const accion = desactivar ? 'desactivada' : 'activada'
    showToast(
      `Herencia ${accion} en ${successCount} ventana(s)` +
      (failedCount ? `, ${failedCount} sin cambios.` : '.')
    )
    selectedWindows.value = new Set()
  } catch (e) {
    showToast(e.userMessage || 'Error al cambiar la herencia.', 'error')
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
  // El lápiz del grupo abre DIRECTO en edición (un solo paso); finalizadas
  // se abren en vista (sellado total §4); en turno se puede ajustar el fin.
  openModalInEdit.value = !w.isEnded
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

// ---- Acciones de contexto dentro del detalle (móvil: reemplazan el menú
// contextual flotante, que choca con el long-press de mover). ----
const handleModalCopy = (w) => {
  clipboard.value = { type: 'window', data: w, cut: false }
  cutWindowIds.value = new Set()
  showToast('Ventana copiada.')
}
const handleModalCut = (w) => {
  clipboard.value = { type: 'window', data: w, cut: true }
  cutWindowIds.value = new Set([w.id])
  showToast('Ventana cortada.')
}
const handleModalAddSpecialist = (w) => {
  prefillData.value = { dates: [w.scheduledDate], startTime: w.startTime, endTime: w.endTime, applicationId: w.applicationId }
  closeWindowModal()
  mostrarCrear.value = true
}
const handleModalPaste = async (w) => {
  closeWindowModal()
  await pasteOnSlot(w.scheduledDate, w.startTime, w.endTime)
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
    else if (mostrarBulk.value) { mostrarBulk.value = false; errorCrear.value = '' }
  }
  // Delete/Supr: eliminar ventanas seleccionadas o la ventana activa
  if (e.key === 'Delete') {
    if (selectedWindows.value.size > 0) { handleBatchDelete(); return }
    if (selectedWindow.value) { handleDelete(selectedWindow.value); return }
  }
  // Atajos de herramienta (V/E/S) — solo admin, sin modificadores y fuera de campos de texto
  if (authStore.isAdmin && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
    const k = e.key.toLowerCase()
    if (k === 'v') { setTool('default'); return }
    if (k === 'e') { setTool('eraser'); return }
    if (k === 's') { setTool('select'); return }
  }
}

// No capturar atajos de letra mientras se escribe en un campo
function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

// ---- Modales deep-linkables (URL ↔ estado, con botón Atrás) ----
// Sincronización bidireccional guardada contra bucles. La URL refleja el modal
// abierto: ?window=<id> (detalle), ?group=<id-de-una-ventana-del-grupo>, o
// ?new=1 (crear). En móvil estos se presentan a pantalla completa (subruta
// estilo Google Calendar): Atrás cierra. Los tres van en UN solo watch para que
// transiciones en el mismo tick (p.ej. detalle→crear) no choquen con el guard.
let _modalSyncing = false

// refs → URL (abrir = push para que Atrás cierre; cerrar = replace)
watch([selectedWindow, selectedGroup, mostrarCrear, mostrarBulk], ([w, g, creating, bulk]) => {
  if (_modalSyncing) return
  const q = { ...route.query }
  delete q.window
  delete q.group
  delete q.new
  if (w) q.window = w.id
  else if (g) q.group = g.windows?.[0]?.id
  else if (creating) q.new = '1'
  else if (bulk) q.new = 'bulk'
  if (q.window === route.query.window && q.group === route.query.group && q.new === route.query.new) return
  const opening = !!(w || g || creating || bulk)
  _modalSyncing = true
  const nav = opening ? router.push({ query: q }) : router.replace({ query: q })
  Promise.resolve(nav).catch(() => {}).finally(() => { _modalSyncing = false })
})

// URL → refs (Atrás/Adelante, deep-link en frío)
function syncModalsFromRoute() {
  if (_modalSyncing) return
  const wid = route.query.window
  const gid = route.query.group
  const isNew = route.query.new
  _modalSyncing = true
  if (wid) {
    // No reasignar si ya apunta a la misma ventana (evita churn de prop → parpadeo).
    if (selectedWindow.value?.id !== wid) {
      selectedWindow.value = calStore.windows.find(w => w.id === wid) || null
    }
    if (selectedGroup.value) selectedGroup.value = null
    if (mostrarCrear.value) mostrarCrear.value = false
    if (mostrarBulk.value) mostrarBulk.value = false
  } else if (gid) {
    selectedGroup.value = findGroupForWindow(calStore.windows, gid)
    selectedWindow.value = null
    mostrarCrear.value = false
    mostrarBulk.value = false
  } else if (isNew) {
    selectedWindow.value = null
    selectedGroup.value = null
    mostrarCrear.value = isNew !== 'bulk'
    mostrarBulk.value = isNew === 'bulk'
  } else {
    selectedWindow.value = null
    selectedGroup.value = null
    returnToGroup.value = null
    // Cerrar crear y limpiar su estado al volver con Atrás.
    if (mostrarCrear.value) { mostrarCrear.value = false; errorCrear.value = ''; prefillData.value = null }
    if (mostrarBulk.value) { mostrarBulk.value = false; errorCrear.value = '' }
  }
  _modalSyncing = false
}
watch(() => [route.query.window, route.query.group, route.query.new], syncModalsFromRoute, { immediate: true })

// Reintentar resolución cuando las ventanas cargan tarde (deep-link en frío)
watch(() => calStore.windows, (wins) => {
  if (route.query.window && !selectedWindow.value) {
    selectedWindow.value = calStore.windows.find(w => w.id === route.query.window) || null
  }
  if (route.query.group && !selectedGroup.value) {
    selectedGroup.value = findGroupForWindow(calStore.windows, route.query.group)
  }
  // Reconciliar selección: descartar IDs de ventanas que ya no existen
  // (borradas por borrador/menú/undo/recarga). Mantiene sel-bar__count y las
  // acciones en lote coherentes con lo que realmente hay en pantalla.
  if (selectedWindows.value.size > 0) {
    const live = new Set(wins.map(w => w.id))
    const pruned = new Set([...selectedWindows.value].filter(id => live.has(id)))
    if (pruned.size !== selectedWindows.value.size) selectedWindows.value = pruned
  }
})

onMounted(() => {
  calStore.loadWindows()
  userStore.loadUsers()
  userStore.loadSelects()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  window.addEventListener('click', closeCtxMenu)
  document.addEventListener('click', onViewDdDocClick)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('click', closeCtxMenu)
  document.removeEventListener('click', onViewDdDocClick)
})
</script>

<template>
  <section class="content" :class="{ 'content--with-fab': authStore.isAdmin && isMobile }">
    <!-- El botón de crear vive ahora en el sidebar interno (CalSidebar → Crear).
         En móvil queda el FAB (el sidebar es drawer). -->

    <!-- Board del sidebar: Crear / mini-cal / filtros -->
    <SidebarBoard>
      <CalSidebar />
    </SidebarBoard>

    <!-- Toolbar → board de la topbar en escritorio (el calendario usa ese
         espacio en lugar del título). En móvil queda en sitio, como card. -->
    <TopbarBoard :disabled="isMobile">
    <div class="toolbar">
      <!-- Row 1: nav + label (orden del mockup: Hoy · ‹ › · fecha · … · controles) -->
      <div class="toolbar__row">
        <button class="toolbar__today" @click="slideDir = ''; calStore.goToday()">Hoy</button>
        <button class="toolbar__arrow" @click="slideDir = 'slide-right'; calStore.prevNav()">
          <i class='bx bx-chevron-left'></i>
        </button>
        <button class="toolbar__arrow" @click="slideDir = 'slide-left'; calStore.nextNav()">
          <i class='bx bx-chevron-right'></i>
        </button>
        <button class="toolbar__date-btn" @click="openDatePicker">
          <span class="toolbar__date-text">{{ weekLabel }}</span>
          <i class='bx bx-calendar'></i>
        </button>
        <input ref="datePickerRef" type="date" class="toolbar__date-picker" @change="onDatePicked" />

        <div class="toolbar__spacer"></div>

        <!-- View dropdown (siempre visible) -->
        <div class="viewdd" ref="viewDdRef">
          <button class="viewdd__btn" @click="toggleViewMenu">
            <span>{{ viewLabel }}</span>
            <i class='bx bx-chevron-down viewdd__caret' :class="{ 'viewdd__caret--open': viewMenuOpen }"></i>
          </button>
          <div v-if="viewMenuOpen" class="viewdd__menu">
            <button v-for="opt in VIEW_OPTIONS" :key="opt.key" class="viewdd__opt"
              :class="{ 'viewdd__opt--on': calView === opt.key, 'viewdd__opt--disabled': opt.disabled }"
              @click="selectView(opt)">
              <span>{{ opt.label }}</span>
              <i v-if="calView === opt.key" class='bx bx-check'></i>
              <span v-else-if="opt.disabled" class="viewdd__soon">Próximamente</span>
            </button>
          </div>
        </div>

        <!-- Density selector (desktop only) -->
        <div v-if="!isMobile" class="seg seg--icons toolbar__density">
          <button class="seg__btn" :class="{ 'seg__btn--active': density === 'compact' }"
            @click="calStore.setDensity('compact')" title="Compacto">
            <i class='bx bx-menu'></i>
          </button>
          <button class="seg__btn" :class="{ 'seg__btn--active': density === 'comfortable' }"
            @click="calStore.setDensity('comfortable')" title="Normal">
            <i class='bx bx-align-justify'></i>
          </button>
          <button class="seg__btn" :class="{ 'seg__btn--active': density === 'spacious' }"
            @click="calStore.setDensity('spacious')" title="Espacioso">
            <i class='bx bx-expand-vertical'></i>
          </button>
        </div>

        <!-- Tool toggle (admin only, hidden on mobile via CSS) -->
        <div v-if="authStore.isAdmin" class="seg seg--icons toolbar__tools">
          <button class="seg__btn" :class="{ 'seg__btn--active': activeTool === 'default' }"
            @click="setTool('default')" title="Modo normal (V)">
            <i class='bx bx-pointer'></i>
          </button>
          <button class="seg__btn" :class="{ 'seg__btn--active': activeTool === 'eraser' }"
            @click="setTool('eraser')" title="Borrador (E)">
            <i class='bx bx-eraser'></i>
          </button>
          <button class="seg__btn" :class="{ 'seg__btn--active': activeTool === 'select' }"
            @click="setTool('select')" title="Seleccionar (S)">
            <i class='bx bx-select-multiple'></i>
          </button>
        </div>

        <!-- Undo button (hidden on mobile via CSS) -->
        <button v-if="authStore.isAdmin" class="tb-icon toolbar__undo-btn" :disabled="!canUndo"
          @click="calStore.undo().then(() => showToast('Acción deshecha.')).catch(() => showToast('Error al deshacer.', 'error'))"
          title="Deshacer (Ctrl+Z)">
          <i class='bx bx-undo'></i>
        </button>

        <!-- Toggle de herramientas (móvil; los filtros viven en CalSidebar) -->
        <button v-if="isMobile && authStore.isAdmin" class="toolbar__filter-toggle"
          :class="{ 'toolbar__filter-toggle--active': showMobileFilters }"
          @click="showMobileFilters = !showMobileFilters">
          <i class='bx bx-filter-alt'></i>
        </button>
      </div>

      <!-- Los filtros de especialista/app/estado viven ahora en el sidebar
           interno (CalSidebar). En móvil el toggle de filtros despliega solo
           las herramientas. -->
      <div v-if="isMobile && showMobileFilters" class="toolbar__mobile-filters">
        <div v-if="authStore.isAdmin" class="seg seg--icons toolbar__tools toolbar__tools--mobile">
          <button class="seg__btn" :class="{ 'seg__btn--active': activeTool === 'default' }"
            @click="setTool('default')" title="Modo normal">
            <i class='bx bx-pointer'></i>
          </button>
          <button class="seg__btn" :class="{ 'seg__btn--active': activeTool === 'eraser' }"
            @click="setTool('eraser')" title="Borrador">
            <i class='bx bx-eraser'></i>
          </button>
          <button class="seg__btn" :class="{ 'seg__btn--active': activeTool === 'select' }"
            @click="setTool('select')" title="Seleccionar">
            <i class='bx bx-select-multiple'></i>
          </button>
        </div>
      </div>
    </div>
    </TopbarBoard>

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
        :applications="userStore.applications" :selectable="authStore.isAdmin" :density="density" :is-mobile="isMobile" :view-mode="calView"
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
    <Transition name="ww-modal">
      <WorkWindowModal v-if="selectedWindow" :window="selectedWindow" :specialist-name="calStore.specName(selectedWindow)"
        :application-name="calStore.appName(selectedWindow)"
        :app-color="calStore.findApp(selectedWindow.applicationId)?.color || ''"
        :loading="modalLoading"
        :start-in-edit-mode="openModalInEdit"
        :show-back-button="!!returnToGroup"
        :has-clipboard="!!clipboard"
        @close="closeWindowModal" @back="closeWindowModal"
        @delete="handleDelete" @update="handleUpdate" @toggle="handleToggle"
        @disinherit="handleDisinherit" @reinherit="handleReinherit"
        @copy="handleModalCopy" @cut="handleModalCut"
        @add-specialist="handleModalAddSpecialist" @paste="handleModalPaste" />
    </Transition>

    <!-- Panel grupo -->
    <WindowGroupPanel v-if="selectedGroup" :group="selectedGroup" :specialists="userStore.users"
      :applications="userStore.applications" :all-windows="calStore.windows" :loading="modalLoading" :cut-window-ids="cutWindowIds"
      @close="selectedGroup = null"
      @select="onGroupSelect" @delete="handleDelete"
      @delete-group="handleDeleteGroup" @toggle="handleToggle" @toggle-group="handleToggleGroup"
      @copy="(w) => { clipboard = { type: 'window', data: w, cut: false }; showToast('Ventana copiada.') }"
      @cut="(w) => { clipboard = { type: 'window', data: w, cut: true }; cutWindowIds = new Set([w.id]); showToast('Ventana cortada.') }"
      @disinherit="handleDisinherit" @reinherit="handleReinherit" />

    <!-- Modal crear -->
    <CreateWorkWindowModal :visible="mostrarCrear" :creating="creando" :error="errorCrear"
      :specialists="specialistsConVentana" :applications="userStore.applications" :prefill="prefillData"
      @close="mostrarCrear = false; errorCrear = ''; prefillData = null" @create="handleCreate" />

    <!-- Modal asignación masiva (series recurrentes vía POST /work-windows/recurring) -->
    <BulkAssignModal :visible="mostrarBulk" :creating="creando" :error="errorCrear"
      :specialists="specialistsConVentana" :applications="userStore.applications"
      @close="mostrarBulk = false; errorCrear = ''" @create="handleCreateRecurring" />

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
        <button class="sel-bar__btn" @click="handleBatchInheritToggle"
          :title="selectedAllInherit ? 'Desactivar herencia' : 'Activar herencia'">
          <i class='bx' :class="selectedAllInherit ? 'bx-unlink' : 'bx-link'"></i>
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
      :is-mobile="isMobile" @select="handleCtxAction" @close="closeCtxMenu" />
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

/* Escritorio: el main va sin padding (mainMode 'bare'); el toolbar vive en la
   topbar y el área del grid recupera su respiro lateral aquí. */
@media (min-width: 769px) {
  .content {
    gap: 0.5rem;
  }
  .cal-area {
    padding: 0.25rem 0.75rem 0.75rem;
  }
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
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 1.1rem;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.toolbar__filter-toggle:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
}

/* ---- Toolbar ---- */
/* En escritorio el toolbar se publica en el board de la topbar (TopbarBoard)
   y ocupa el espacio central de la barra: transparente, sin padding propio
   (la topbar ya trae el suyo). En móvil el TopbarBoard va disabled y el
   toolbar queda en sitio, como card dentro de la vista. */
.toolbar {
  background: var(--surface);
  padding: 0.7rem 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

@media (min-width: 769px) {
  .toolbar {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    flex: 1;
    min-width: 0;
  }
}

.toolbar__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.toolbar__spacer {
  flex: 1;
}

/* Ghost circular icon buttons (prev/next, undo) */
.toolbar__arrow,
.tb-icon {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.2rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.14s;
  flex-shrink: 0;
}

.toolbar__arrow:hover,
.tb-icon:not(:disabled):hover {
  background: var(--surface-hover);
  color: var(--text);
}

.tb-icon:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Pill "Hoy" button */
.toolbar__today {
  background: none;
  border: 1px solid var(--border);
  height: 36px;
  padding: 0 1.05rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.toolbar__today:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

/* Date title — large, light weight (Google Calendar style) */
.toolbar__date-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 36px;
  padding: 0 0.6rem;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-right: auto;
  margin-left: 0.4rem;
  transition: all 0.15s;
  min-width: 0;
}

.toolbar__date-btn:hover {
  background: var(--surface-hover);
}

.toolbar__date-btn:hover i {
  color: var(--text);
}

.toolbar__date-text {
  font-size: 1.35rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.toolbar__date-btn i {
  font-size: 0.9rem;
  color: var(--faint);
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

/* View dropdown (replaces segmented Día/Semana/Mes control) */
.viewdd {
  position: relative;
  flex-shrink: 0;
}

.viewdd__btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  height: 36px;
  padding: 0 0.7rem 0 1rem;
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}

.viewdd__btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.viewdd__caret {
  font-size: 1.1rem;
  color: var(--muted);
  transition: transform 0.15s;
}

.viewdd__caret--open {
  transform: rotate(180deg);
}

.viewdd__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 160px;
  z-index: 50;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  box-shadow: var(--shadow-pop);
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.viewdd__opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.7rem;
  border: none;
  background: none;
  border-radius: 7px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--text);
  text-align: left;
  transition: background 0.12s;
}

.viewdd__opt:hover {
  background: var(--surface-hover);
}

.viewdd__opt i {
  font-size: 1rem;
  color: var(--primary-500);
}

.viewdd__opt--on {
  color: var(--primary-500);
  font-weight: 600;
}

.viewdd__opt--disabled {
  cursor: default;
  color: var(--faint);
}

.viewdd__opt--disabled:hover {
  background: none;
}

.viewdd__soon {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--faint);
}

/* Pill segmented controls (tools / density) */
.seg {
  display: flex;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  background: transparent;
  flex-shrink: 0;
}

.seg + .seg,
.seg.toolbar__tools,
.seg.toolbar__density {
  margin-left: 0.25rem;
}

.seg__btn {
  padding: 0 0.7rem;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.seg__btn + .seg__btn {
  border-left: 1px solid var(--border);
}

.seg__btn:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.seg__btn--active {
  background: var(--primary-500);
  color: #fff;
}

.seg__btn--active:hover {
  background: var(--primary-600);
  color: #fff;
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

  .toolbar__date-text {
    font-size: 1rem;
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
    width: 30px;
    height: 30px;
    font-size: 1rem;
  }

  .toolbar__today {
    height: 30px;
    padding: 0 0.6rem;
    font-size: 0.7rem;
  }

  .toolbar__date-text {
    font-size: 0.95rem;
  }

  .toolbar__date-btn {
    padding: 0.15rem 0.3rem;
    gap: 0.25rem;
  }

  .toolbar__date-btn i {
    font-size: 0.75rem;
  }

  .viewdd__btn {
    height: 30px;
    padding: 0 0.5rem 0 0.7rem;
    font-size: 0.7rem;
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

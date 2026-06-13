<script setup>
import '@/presentation/styles/calendar/WindowGroupPanel.css'
import '@/presentation/styles/components/calendar/cal-modal.css'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'
import { computed } from 'vue'
import { fmtTime12h } from '@/presentation/helpers/formatTime'
import { fmtDateLocale } from '@/presentation/helpers/formatDate'

const props = defineProps({
  group: { type: Object, default: null },
  specialists: { type: Array, default: () => [] },
  allWindows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  cutWindowIds: { type: Object, default: () => new Set() },
})

const emit = defineEmits(['close', 'select', 'toggle', 'delete', 'delete-group', 'toggle-group', 'copy', 'cut', 'disinherit', 'reinherit', 'add-specialist', 'context'])

// ---- Menú contextual por miembro (clic derecho / long-press) ----
// Reusa el mismo menú de ventana del calendario: emitimos { window, x, y }
// y la vista lo enruta a onWindowContext.
function onMemberContext(w, e) {
  emit('context', { window: w, x: e.clientX, y: e.clientY })
}

let lpTimer = null
let lpFired = false
function onMemberPressStart(w, e) {
  lpFired = false
  const t = e.touches?.[0]
  if (!t) return
  const { clientX: x, clientY: y } = t
  lpTimer = setTimeout(() => {
    lpFired = true
    emit('context', { window: w, x, y })
  }, 500)
}
function onMemberPressEnd() { clearTimeout(lpTimer); lpTimer = null }
function onMemberClickGuard(w, e) {
  // Si el long-press ya disparó el menú, no abras también el detalle.
  if (lpFired) { lpFired = false; e.preventDefault(); return }
  emit('select', w)
}

const findSpec = (id) => props.specialists.find(s => s.specialistId === id) || { fullName: id, specialistId: id }

const windows = computed(() => props.group?.windows || [])

const uniqueSpecCount = computed(() => new Set(windows.value.map(w => w.specialistId)).size)

const timeLabel = computed(() => {
  const w = windows.value[0]
  if (!w) return ''
  return `${fmtTime12h(w.startTime)} – ${fmtTime12h(w.endTime)}`
})

const dayLabel = computed(() => {
  const w = windows.value[0]
  return w ? fmtDateLocale(w.scheduledDate) : ''
})

const activeCount = computed(() => windows.value.filter(w => w.isActive).length)
const allActive = computed(() => activeCount.value === windows.value.length)
const noneActive = computed(() => activeCount.value === 0)

const statusText = computed(() => {
  if (allActive.value) return 'Activas'
  if (noneActive.value) return 'Inactivas'
  return `${activeCount.value} activas · ${windows.value.length - activeCount.value} inactivas`
})

// ---- Acciones de grupo ----
const groupToggleTargets = computed(() => {
  const wantDisable = activeCount.value > 0
  return windows.value.filter(w => w.canToggle && w.isActive === wantDisable)
})

const groupToggleLabel = computed(() =>
  activeCount.value > 0
    ? `Inhabilitar (${groupToggleTargets.value.length})`
    : `Habilitar (${groupToggleTargets.value.length})`
)

function onGroupToggle() {
  if (groupToggleTargets.value.length === 0) return
  emit('toggle-group', groupToggleTargets.value)
}

// Regla de borrado: selladas no se eliminan; el grupo solo es eliminable si
// TODAS sus ventanas son futuras.
const canDeleteGroup = computed(() => windows.value.every(w => w.isFuture))

// Sumar un especialista al turno: solo si el grupo aún es futuro.
const canAddSpecialist = computed(() => windows.value.length > 0 && windows.value.every(w => w.isFuture))
</script>

<template>
  <div v-if="group" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal wgp">
      <!-- Header -->
      <header class="wgp__head">
        <div class="wgp__head-icon"><i class='bx bx-group'></i></div>
        <div class="wgp__head-text">
          <h2 class="wgp__title">{{ uniqueSpecCount }} especialistas</h2>
          <p class="wgp__sub">Turno compartido</p>
        </div>
        <button class="wgp__close" @click="$emit('close')" title="Cerrar"><i class='bx bx-x'></i></button>
      </header>

      <!-- Resumen del turno -->
      <div class="wgp__summary">
        <div class="wgp__sum-item">
          <i class='bx bx-time-five'></i>
          <div>
            <span class="wgp__sum-label">Horario</span>
            <span class="wgp__sum-val">{{ timeLabel }}</span>
          </div>
        </div>
        <div class="wgp__sum-item">
          <i class='bx bx-calendar'></i>
          <div>
            <span class="wgp__sum-label">Día</span>
            <span class="wgp__sum-val">{{ dayLabel }}</span>
          </div>
        </div>
        <div class="wgp__sum-item wgp__sum-item--status">
          <i class='bx bx-pulse'></i>
          <div>
            <span class="wgp__sum-label">Estado</span>
            <span class="pill-status" :class="noneActive ? 'pill-status--inactive' : 'pill-status--active'">
              {{ statusText }}
            </span>
          </div>
        </div>
      </div>

      <!-- Miembros -->
      <div class="modal__body wgp__body">
        <div class="mmembers">
          <div class="mmembers__head">
            <span>Especialistas en este turno</span>
            <div class="mmembers__head-right">
              <button v-if="canAddSpecialist" class="mmembers__add" :disabled="loading"
                title="Sumar otro especialista a este turno" @click="$emit('add-specialist', group)">
                <i class='bx bx-user-plus'></i> Agregar
              </button>
              <span class="mmembers__count">{{ windows.length }}</span>
            </div>
          </div>
          <div class="mmembers__list">
            <!-- Toda la fila es el affordance de edición: clic, Tab (focus) o
                 Enter abren el detalle de esa persona — sin botón de lápiz. -->
            <div v-for="w in windows" :key="w.id" class="mmember mmember--clickable"
              :class="{ 'mmember--inactive': !w.isActive, 'mmember--cut': cutWindowIds.has(w.id) }"
              role="button"
              tabindex="0"
              :title="`Editar a ${findSpec(w.specialistId).fullName}`"
              @click="onMemberClickGuard(w, $event)"
              @focus="$emit('select', w)"
              @keydown.enter.prevent="$emit('select', w)"
              @contextmenu.prevent="onMemberContext(w, $event)"
              @touchstart.passive="onMemberPressStart(w, $event)"
              @touchend="onMemberPressEnd"
              @touchmove.passive="onMemberPressEnd">
              <UserAvatar :preferences="findSpec(w.specialistId).preferences" :name="findSpec(w.specialistId).fullName" size="24px" />
              <span class="mmember__name">{{ findSpec(w.specialistId).fullName }}</span>
              <span v-if="!w.isActive" class="mmember__off">Inactiva</span>
              <button v-if="w.canToggle" class="mmember__btn" :disabled="loading" tabindex="-1"
                :title="w.isActive ? 'Inhabilitar' : 'Habilitar'" @click.stop="$emit('toggle', w)">
                <i class='bx' :class="w.isActive ? 'bx-block' : 'bx-check-circle'"></i>
              </button>
              <i class='bx bx-chevron-right mmember__go'></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal__foot">
        <button v-if="groupToggleTargets.length" class="mbtn" :disabled="loading" @click="onGroupToggle">
          <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
          {{ groupToggleLabel }}
        </button>
        <button class="mbtn mbtn--danger" :disabled="loading || !canDeleteGroup"
          :title="!canDeleteGroup ? 'El grupo contiene ventanas que ya iniciaron y no se pueden eliminar.' : undefined"
          @click="$emit('delete-group', group)">
          <i v-if="loading" class='bx bx-loader-alt bx-spin'></i>
          Eliminar ({{ windows.length }})
        </button>
      </div>
    </div>
  </div>
</template>

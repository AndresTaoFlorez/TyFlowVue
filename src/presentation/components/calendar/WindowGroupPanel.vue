<script setup>
import '@/styles/components/calendar/cal-modal.css'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'
import { computed } from 'vue'
import { fmtTime12h } from '@/presentation/helpers/formatTime'
import { fmtDateLocale } from '@/presentation/helpers/formatDate'

const props = defineProps({
  group: { type: Object, default: null },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  allWindows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  cutWindowIds: { type: Object, default: () => new Set() },
})

const emit = defineEmits(['close', 'select', 'toggle', 'delete', 'delete-group', 'toggle-group', 'copy', 'cut', 'disinherit', 'reinherit'])

// Color por defecto del grupo (mismo criterio que WindowGroupBlock)
const GROUP_COLOR = '#2AC78F'

const findSpec = (id) => props.specialists.find(s => s.specialistId === id) || { fullName: id, specialistId: id }
const findApp = (w) => props.applications.find(a => a.id === w.applicationId)
const appName = (w) => findApp(w)?.name || w.applicationId
const appColor = (w) => { const a = findApp(w); return a?.color || a?.theme?.color || GROUP_COLOR }

const windows = computed(() => props.group?.windows || [])

const uniqueSpecCount = computed(() => new Set(windows.value.map(w => w.specialistId)).size)

// App única del grupo (o null si hay varias)
const singleApp = computed(() => {
  const ids = new Set(windows.value.map(w => w.applicationId))
  if (ids.size !== 1) return null
  return findApp(windows.value[0]) || null
})

const headerColor = computed(() => singleApp.value?.color || GROUP_COLOR)

const subTitle = computed(() =>
  'Turno compartido · ' + (singleApp.value ? singleApp.value.name : 'varias aplicaciones')
)

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
// "Inhabilitar (N)" apaga las activas toggleables; si ninguna activa,
// "Habilitar (N)" enciende las inactivas toggleables.
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

// Regla de borrado: selladas (ya iniciaron o pasaron) no se eliminan; el
// grupo solo es eliminable si TODAS sus ventanas son futuras.
const canDeleteGroup = computed(() => windows.value.every(w => w.isFuture))
</script>

<template>
  <div v-if="group" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal wgp" :style="{ '--app': headerColor }">
      <div class="modal__top"></div>

      <!-- Header -->
      <div class="modal__head">
        <div>
          <div class="modal__title">{{ uniqueSpecCount }} especialistas</div>
          <div class="modal__sub">{{ subTitle }}</div>
        </div>
        <button class="modal__x" @click="$emit('close')" title="Cerrar">&times;</button>
      </div>

      <!-- Body -->
      <div class="modal__body">
        <div class="mrow">
          <i class='bx bx-time-five'></i>
          <span class="mrow__label">Horario</span>
          <span class="mrow__val">{{ timeLabel }}</span>
        </div>
        <div class="mrow">
          <i class='bx bx-calendar'></i>
          <span class="mrow__label">Día</span>
          <span class="mrow__val">{{ dayLabel }}</span>
        </div>
        <div v-if="singleApp" class="mrow">
          <i class='bx bx-grid-alt'></i>
          <span class="mrow__label">Aplicación</span>
          <span class="mrow__val">{{ singleApp.name }}</span>
        </div>
        <div class="mrow">
          <i class='bx bx-pulse'></i>
          <span class="mrow__label">Estado</span>
          <span class="pill-status" :class="noneActive ? 'pill-status--inactive' : 'pill-status--active'">
            <i class='bx' :class="noneActive ? 'bx-block' : 'bxs-circle'" style="font-size:0.6rem"></i>
            {{ statusText }}
          </span>
        </div>

        <!-- Miembros -->
        <div class="mmembers">
          <div class="mmembers__head">
            <span>Especialistas en este turno</span>
            <span class="mmembers__count">{{ windows.length }}</span>
          </div>
          <div class="mmembers__list">
            <div v-for="w in windows" :key="w.id" class="mmember"
              :class="{ 'mmember--inactive': !w.isActive, 'mmember--cut': cutWindowIds.has(w.id) }">
              <UserAvatar :preferences="findSpec(w.specialistId).preferences" :name="findSpec(w.specialistId).fullName" size="22px" />
              <span class="mmember__name">{{ findSpec(w.specialistId).fullName }}</span>
              <span v-if="!singleApp" class="mmember__app" :style="{ '--c': appColor(w) }">{{ appName(w) }}</span>
              <button v-if="w.canToggle" class="mmember__btn" :disabled="loading"
                :title="w.isActive ? 'Inhabilitar' : 'Habilitar'" @click="$emit('toggle', w)">
                <i class='bx' :class="w.isActive ? 'bx-block' : 'bx-check-circle'"></i>
              </button>
              <button class="mmember__btn" :disabled="loading"
                title="Editar solo a esta persona" @click="$emit('select', w)">
                <i class='bx bx-pencil'></i>
              </button>
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

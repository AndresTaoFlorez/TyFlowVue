<script setup>
import ContextMenu from '@/presentation/components/shared/ContextMenu.vue'
import SpecialistGroupCard from '@/presentation/components/calendar/SpecialistGroupCard.vue'
import { ref, computed } from 'vue'

const props = defineProps({
  group: { type: Object, default: null },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  allWindows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  cutWindowIds: { type: Object, default: () => new Set() },
})

const emit = defineEmits(['close', 'select', 'toggle', 'delete', 'delete-group', 'copy', 'cut', 'disinherit', 'reinherit'])

// ---- View state: list (specialist cards) vs detail (one specialist's windows) ----
const viewMode = ref('list')          // 'list' | 'detail'
const detailSpecialistId = ref(null)

function openDetail(specialistId) {
  detailSpecialistId.value = specialistId
  viewMode.value = 'detail'
}
function backToList() {
  viewMode.value = 'list'
  detailSpecialistId.value = null
}

// ---- Helpers (unchanged) ----
const specName = (w) => props.specialists.find(s => s.specialistId === w.specialistId)?.fullName || w.specialistId
const findSpec = (id) => props.specialists.find(s => s.specialistId === id) || { fullName: id, specialistId: id }
const findApp = (w) => props.applications.find(a => a.id === w.applicationId)
const appName = (w) => findApp(w)?.name || w.applicationId
const appColor = (w) => { const a = findApp(w); return a?.color || a?.theme?.color || '#2AC78F' }

const inheritLabel = (w) => {
  if (!w.inheritedFromWindowId) return ''
  const parent = props.allWindows.find(p => p.id === w.inheritedFromWindowId)
  if (parent) {
    const name = specName(parent)
    const time = parent.timeRange
    const dayNum = parent.scheduledDate ? parseInt(parent.scheduledDate.split('-')[2], 10) : ''
    return `← ${name} · ${dayNum} ${time}`
  }
  return '← (otra semana)'
}

const statusLabel = (w) => w.isActive ? 'Activa' : 'Inactiva'
const statusClass = (w) => w.isActive ? 'item--active' : 'item--inactive'

// ---- Group windows by specialist ----
const specGroups = computed(() => {
  if (!props.group) return []
  const map = new Map()
  for (const w of props.group.windows) {
    if (!map.has(w.specialistId)) map.set(w.specialistId, [])
    map.get(w.specialistId).push(w)
  }
  return [...map.entries()].map(([sid, ws]) => ({
    specialistId: sid,
    specialist: findSpec(sid),
    windows: ws,
  }))
})

// Detail view: the specialist group being drilled into
const detailGroup = computed(() =>
  specGroups.value.find(g => g.specialistId === detailSpecialistId.value) || null
)

const initialsOf = (name) => name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()

// ---- Specialist-level actions ----
function handleToggleAll(sg) {
  for (const w of sg.windows) {
    if (w.isActive && w.canToggle) emit('toggle', w)
  }
}

function handleDeleteAll(sg) {
  for (const w of sg.windows) {
    if (w.canEdit) emit('delete', w)
  }
}

// ---- Context menu per item (unchanged) ----
const ctx = ref({ visible: false, x: 0, y: 0, items: [], target: null })

function onItemContext(w, e) {
  e.preventDefault()
  const now = new Date()
  const isFuture = w.startsAt && new Date(w.startsAt) > now
  const isEnded = w.endsAt && new Date(w.endsAt) < now
  const hasInheritance = !!(w.inheritedFromWindowId || w.inheritsOnReopen)
  const inheritItem = isFuture
    ? (hasInheritance
      ? { label: 'Desactivar herencia', icon: 'bx-unlink', action: 'disinherit' }
      : { label: 'Activar herencia', icon: 'bx-link', action: 'reinherit' })
    : null
  const items = [
    { label: 'Ver detalle', icon: 'bx-expand-alt', action: 'select' },
    ...(!isEnded ? [{ label: w.isActive ? 'Inhabilitar' : 'Habilitar', icon: w.isActive ? 'bx-block' : 'bx-check-circle', action: 'toggle' }] : []),
    ...(inheritItem ? [inheritItem] : []),
    { label: 'Copiar ventana', icon: 'bx-copy', action: 'copy' },
    ...(isFuture ? [{ label: 'Cortar ventana', icon: 'bx-cut', action: 'cut' }] : []),
    ...(isFuture ? [{ label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true }] : []),
  ]
  ctx.value = { visible: true, x: e.clientX, y: e.clientY, items, target: w }
}

function onCtxAction(action) {
  const w = ctx.value.target
  ctx.value.visible = false
  switch (action) {
    case 'select': emit('select', w); break
    case 'toggle': emit('toggle', w); break
    case 'copy': emit('copy', w); break
    case 'cut': emit('cut', w); break
    case 'disinherit': emit('disinherit', w); break
    case 'reinherit': emit('reinherit', w); break
    case 'delete': emit('delete', w); break
  }
}
</script>

<template>
  <div v-if="group" class="panel-overlay" @click.self="$emit('close')" @click="ctx.visible = false">
    <div class="panel">

      <!-- ============ LIST MODE: one card per specialist ============ -->
      <template v-if="viewMode === 'list'">
        <div class="panel__header">
          <h3>
            {{ group.windows.length }} ventanas
            <small>· {{ specGroups.length }} {{ specGroups.length === 1 ? 'especialista' : 'especialistas' }}</small>
          </h3>
          <div class="panel__header-actions">
            <button
              class="panel__delete"
              :disabled="loading"
              @click="$emit('delete-group', group)"
              title="Eliminar grupo"
            >
              <i class='bx bx-trash'></i>
            </button>
            <button @click="$emit('close')" class="panel__close"><i class='bx bx-x'></i></button>
          </div>
        </div>

        <div class="panel__body">
          <SpecialistGroupCard
            v-for="sg in specGroups"
            :key="sg.specialistId"
            :specialist="sg.specialist"
            :windows="sg.windows"
            :applications="applications"
            :all-windows="allWindows"
            :loading="loading"
            :cut-window-ids="cutWindowIds"
            @show-all="openDetail(sg.specialistId)"
            @select="(w) => $emit('select', w)"
            @toggle-all="handleToggleAll(sg)"
            @delete-all="handleDeleteAll(sg)"
          />
        </div>
      </template>

      <!-- ============ DETAIL MODE: drill-down for one specialist ============ -->
      <template v-else-if="viewMode === 'detail' && detailGroup">
        <div class="panel__header">
          <button class="panel__back" title="Volver" @click="backToList"><i class="bx bx-arrow-back"></i></button>
          <h3>
            {{ detailGroup.windows.length }} ventanas
            <small>· {{ detailGroup.specialist.fullName }}</small>
          </h3>
          <div class="panel__header-actions">
            <button
              class="panel__delete"
              :disabled="loading"
              @click="handleDeleteAll(detailGroup)"
              title="Eliminar todas"
            >
              <i class='bx bx-trash'></i>
            </button>
            <button @click="backToList" class="panel__close"><i class='bx bx-x'></i></button>
          </div>
        </div>

        <!-- Specialist summary header -->
        <div class="detail-head">
          <div class="detail-head__avatar" :style="{ background: appColor(detailGroup.windows[0]) }">
            {{ initialsOf(detailGroup.specialist.fullName) }}
          </div>
          <div class="detail-head__info">
            <div class="detail-head__name">{{ detailGroup.specialist.fullName }}</div>
            <div class="detail-head__meta">
              {{ [...new Set(detailGroup.windows.map(w => w.applicationId))].length }} aplicativos
              · {{ detailGroup.windows.filter(w => w.isActive).length }}/{{ detailGroup.windows.length }} activas
            </div>
          </div>
          <div class="detail-head__spacer"></div>
          <div class="detail-head__counters">
            <span class="detail-head__ctr detail-head__ctr--open">
              <i class="bx bx-log-in-circle"></i>{{ detailGroup.windows.reduce((n, w) => n + (w.openingCount ?? 0), 0) }}
            </span>
            <span class="detail-head__ctr detail-head__ctr--current">
              <i class="bx bx-radio-circle-marked"></i>{{ detailGroup.windows.reduce((n, w) => n + (w.currentCount ?? 0), 0) }}
            </span>
          </div>
        </div>

        <!-- Window rows (same markup as original flat view) -->
        <div class="panel__body">
          <div
            v-for="w in detailGroup.windows"
            :key="w.id"
            class="item"
            :class="[statusClass(w), { 'item--cut': cutWindowIds.has(w.id) }]"
            :style="{ '--item-color': appColor(w) }"
            @contextmenu="onItemContext(w, $event)"
          >
            <div class="item__color-dot" :style="{ background: appColor(w) }"></div>
            <div class="item__info" @click="$emit('select', w)">
              <span class="item__name">
                <i v-if="w.inheritedFromWindowId || w.inheritsOnReopen" class='bx bx-link item__inherit-icon'></i>
                {{ appName(w) }}
              </span>
              <span class="item__time">
                {{ w.timeRange }}
                <span class="item__status" :class="w.isActive ? 'item__status--active' : 'item__status--inactive'">
                  {{ statusLabel(w) }}
                </span>
              </span>
              <span v-if="inheritLabel(w)" class="item__inherit-label" :title="inheritLabel(w)">
                {{ inheritLabel(w) }}
              </span>
            </div>
            <div class="item__counts">
              <span class="item__count item__count--open" title="Apertura">
                <i class="bx bx-log-in-circle"></i> {{ w.openingCount ?? 0 }}
              </span>
              <span class="item__count item__count--current" title="Actual">
                <i class="bx bx-radio-circle-marked"></i> {{ w.currentCount ?? 0 }}
              </span>
              <span v-if="w.closingCount != null" class="item__count item__count--close" title="Cierre">
                <i class="bx bx-log-out-circle"></i> {{ w.closingCount }}
              </span>
            </div>

            <div class="item__actions">
              <button
                v-if="w.canToggle"
                class="item__btn"
                :class="w.isActive ? 'item__btn--close' : 'item__btn--open'"
                :disabled="loading"
                @click.stop="$emit('toggle', w)"
                :title="w.isActive ? 'Inhabilitar' : 'Habilitar'"
              >
                <i class='bx' :class="w.isActive ? 'bx-block' : 'bx-check-circle'"></i>
              </button>
              <button
                v-if="w.canEdit"
                class="item__btn item__btn--delete"
                :disabled="loading"
                @click.stop="$emit('delete', w)"
                title="Eliminar"
              >
                <i class='bx bx-trash'></i>
              </button>
              <button
                class="item__btn"
                @click.stop="onItemContext(w, $event)"
                title="Más opciones"
              >
                <i class='bx bx-dots-vertical-rounded'></i>
              </button>
            </div>
          </div>
        </div>
      </template>

    </div>

    <ContextMenu
      :visible="ctx.visible"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctx.items"
      @select="onCtxAction"
      @close="ctx.visible = false"
    />
  </div>
</template>

<style scoped>
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 12, 20, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
  box-sizing: border-box;
  animation: panel-fade-in 0.15s ease;
}

@keyframes panel-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.panel {
  background: var(--bg-main, white);
  width: 100%;
  max-width: 460px;
  border-radius: var(--radius-xl, 16px);
  box-shadow: 0 12px 32px rgba(20, 30, 55, 0.16);
  overflow: hidden;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  animation: panel-pop 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

@keyframes panel-pop {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.panel__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-light);
}

.panel__header h3 {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
}

.panel__header h3 small {
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.panel__header-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.panel__back {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border: 1px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.12s;
}

.panel__back:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.panel__delete {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 0.95rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.12s;
}

.panel__delete:hover:not(:disabled) {
  color: var(--error-500);
  border-color: var(--error-500);
  background: rgba(239, 68, 68, 0.06);
}

.panel__delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.panel__close {
  background: none;
  border: none;
  font-size: 1.3rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.panel__body {
  padding: 0.6rem;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
}

.panel__body::-webkit-scrollbar { width: 8px; }
.panel__body::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 4px; }

/* ============================================================
   Detail sub-view header
   ============================================================ */
.detail-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.1rem 0.5rem;
  border-bottom: 1px solid var(--border-light);
}

.detail-head__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.detail-head__info { min-width: 0; }
.detail-head__name { font-size: 0.88rem; font-weight: 600; }
.detail-head__meta { font-size: 0.68rem; color: var(--text-secondary); }
.detail-head__spacer { flex: 1; }

.detail-head__counters { display: flex; gap: 0.3rem; flex-shrink: 0; }
.detail-head__ctr {
  display: inline-flex; align-items: center; gap: 0.2rem;
  font-size: 0.66rem; font-weight: 700; padding: 0.12rem 0.4rem;
  border-radius: 5px; line-height: 1.4; white-space: nowrap;
}
.detail-head__ctr i { font-size: 0.82rem; }
.detail-head__ctr--open { background: rgba(42, 199, 143, 0.14); color: var(--primary-600); }
.detail-head__ctr--current { background: rgba(99, 102, 241, 0.14); color: #6366f1; }

/* ============================================================
   Window item rows (kept from original — detail sub-view)
   ============================================================ */
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.75rem;
  padding-top: 1.4rem;
  border-radius: var(--radius-md);
  margin-bottom: 0.25rem;
  border-left: 4px solid var(--item-color, var(--primary-500));
  transition: background 0.1s, opacity 0.15s;
  position: relative;
}

.item:hover { background: var(--bg-card); }

.item--inactive {
  opacity: 0.5;
  border-left-color: var(--inactive-bar);
  background: rgba(100, 110, 130, 0.06);
}

.item--inactive .item__name {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.item--inactive .item__color-dot {
  opacity: 0.35;
}

.item--cut {
  opacity: 0.4;
  border-left-style: dashed;
  filter: grayscale(0.5);
}

.item__color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.item__info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
  cursor: pointer;
}

.item__name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.item__inherit-icon {
  font-size: 0.8rem;
  opacity: 0.5;
  flex-shrink: 0;
}

.item__inherit-label {
  font-size: 0.62rem;
  color: var(--text-secondary);
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
}

.item__time {
  font-size: 0.68rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.item__status {
  font-size: 0.6rem;
  font-weight: 600;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}

.item__status--active {
  color: var(--primary-500);
  background: rgba(42, 199, 143, 0.1);
}

.item__status--inactive {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.item__counts {
  position: absolute;
  top: 0.3rem;
  right: 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.item__count {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.58rem;
  font-weight: 700;
  padding: 0.08rem 0.28rem;
  border-radius: 3px;
  line-height: 1.3;
  white-space: nowrap;
}

.item__count i { font-size: 0.72rem; }

.item__count--open {
  background: rgba(42, 199, 143, 0.12);
  color: var(--primary-600, #1fa672);
}

.item__count--current {
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
}

.item__count--close {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.item__actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.item__btn {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 0.9rem;
  width: 1.8rem;
  height: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.12s;
}

.item__btn:hover:not(:disabled) { color: var(--text-primary); border-color: var(--text-secondary); }
.item__btn--open:hover:not(:disabled) { color: var(--primary-500); border-color: var(--primary-500); }
.item__btn--close:hover:not(:disabled) { color: #607dea; border-color: #607dea; }
.item__btn--delete:hover:not(:disabled) { color: var(--error-500); border-color: var(--error-500); }
.item__btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 480px) {
  .panel {
    max-width: calc(100% - 2rem);
    border-radius: var(--radius-md);
  }

  .item__counts { gap: 0.15rem; }

  .item__count {
    padding: 0.08rem 0.2rem;
    font-size: 0;
  }
  .item__count i {
    font-size: 0.8rem;
  }
}
</style>

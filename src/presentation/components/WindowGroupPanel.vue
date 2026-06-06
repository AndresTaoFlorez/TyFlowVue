<script setup>
import ContextMenu from '@/presentation/components/ContextMenu.vue'
import { ref } from 'vue'

const props = defineProps({
  group: { type: Object, default: null },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  allWindows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  cutWindowIds: { type: Object, default: () => new Set() },
})

const emit = defineEmits(['close', 'select', 'toggle', 'delete', 'delete-group', 'copy', 'cut', 'disinherit', 'reinherit'])

const specName = (w) => props.specialists.find(s => s.specialistId === w.specialistId)?.fullName || w.specialistId
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

// Context menu per item
const ctx = ref({ visible: false, x: 0, y: 0, items: [], target: null })

function onItemContext(w, e) {
  e.preventDefault()
  const isFutureWindow = w.startsAt && new Date(w.startsAt) > new Date()
  const hasInheritance = !!(w.inheritedFromWindowId || w.inheritsOnReopen)
  const inheritItem = isFutureWindow
    ? (hasInheritance
      ? { label: 'Desactivar herencia', icon: 'bx-unlink', action: 'disinherit' }
      : { label: 'Activar herencia', icon: 'bx-link', action: 'reinherit' })
    : null
  const items = [
    { label: 'Ver detalle', icon: 'bx-expand-alt', action: 'select' },
    { label: w.isActive ? 'Inhabilitar' : 'Habilitar', icon: w.isActive ? 'bx-block' : 'bx-check-circle', action: 'toggle' },
    ...(inheritItem ? [inheritItem] : []),
    { label: 'Copiar ventana', icon: 'bx-copy', action: 'copy' },
    ...(isFutureWindow ? [{ label: 'Cortar ventana', icon: 'bx-cut', action: 'cut' }] : []),
    { label: 'Eliminar', icon: 'bx-trash', action: 'delete', danger: true },
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
      <div class="panel__header">
        <h3>{{ group.windows.length }} ventanas</h3>
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
        <div
          v-for="w in group.windows"
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
              {{ specName(w) }}
            </span>
            <span class="item__app">{{ appName(w) }}</span>
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
              class="item__btn"
              :class="w.isActive ? 'item__btn--close' : 'item__btn--open'"
              :disabled="loading"
              @click.stop="$emit('toggle', w)"
              :title="w.isActive ? 'Inhabilitar' : 'Habilitar'"
            >
              <i class='bx' :class="w.isActive ? 'bx-block' : 'bx-check-circle'"></i>
            </button>
            <button
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
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
  box-sizing: border-box;
}

.panel {
  background: white;
  width: 100%;
  max-width: 420px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
}

.panel__header h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.panel__header-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
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
  padding: 0.5rem;
  overflow-y: auto;
  flex: 1;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.75rem;
  padding-top: 1.4rem;
  border-radius: var(--radius-md);
  margin-bottom: 0.25rem;
  border-left: 3px solid var(--item-color, var(--primary-500));
  transition: background 0.1s, opacity 0.15s;
  position: relative;
}

.item:hover { background: var(--bg-card); }

/* Inactive window styling */
.item--inactive {
  opacity: 0.5;
  border-left-color: #9ca3af;
  background: rgba(100, 110, 130, 0.06);
}

.item--inactive .item__name {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.item--inactive .item__color-dot {
  opacity: 0.35;
}

/* Cut — dashed, tenue */
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

.item__app {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-secondary);
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

  /* On small screens: hide text, keep only icon */
  .item__count {
    padding: 0.08rem 0.2rem;
    font-size: 0;        /* hide number text */
  }
  .item__count i {
    font-size: 0.8rem;   /* keep icon visible */
  }
}
</style>

<script setup>
const props = defineProps({
  group: { type: Object, default: null },
  specialists: { type: Array, default: () => [] },
  applications: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

defineEmits(['close', 'select', 'toggle', 'delete', 'delete-group', 'ungroup'])

const specName = (w) => props.specialists.find(s => s.specialistId === w.specialistId)?.fullName || w.specialistId
const appName = (w) => props.applications.find(a => a.id === w.applicationId)?.name || w.applicationId

const statusLabel = (w) => w.isActive ? 'Activa' : 'Inactiva'
const statusClass = (w) => w.isActive ? 'item--open' : 'item--closed'
</script>

<template>
  <div v-if="group" class="panel-overlay" @click.self="$emit('close')">
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
          :class="statusClass(w)"
        >
          <div class="item__info">
            <span class="item__name">{{ specName(w) }}</span>
            <span class="item__app">{{ appName(w) }}</span>
            <span class="item__time">{{ w.timeRange }} · {{ statusLabel(w) }}</span>
          </div>
          <div class="item__actions">
            <button
              class="item__btn"
              :class="w.isActive ? 'item__btn--close' : 'item__btn--open'"
              :disabled="loading"
              @click="$emit('toggle', w)"
              :title="w.isActive ? 'Inhabilitar' : 'Habilitar'"
            >
              <i class='bx' :class="w.isActive ? 'bx-block' : 'bx-check-circle'"></i>
            </button>
            <button
              class="item__btn item__btn--ungroup"
              :disabled="loading"
              @click="$emit('ungroup', w)"
              title="Desagrupar"
            >
              <i class='bx bx-transfer-alt'></i>
            </button>
            <button
              class="item__btn item__btn--delete"
              :disabled="loading"
              @click="$emit('delete', w)"
              title="Eliminar"
            >
              <i class='bx bx-trash'></i>
            </button>
            <button
              class="item__btn"
              @click="$emit('select', w)"
              title="Ver detalle"
            >
              <i class='bx bx-expand-alt'></i>
            </button>
          </div>
        </div>
      </div>
    </div>
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
  border-radius: var(--radius-md);
  margin-bottom: 0.25rem;
  border-left: 3px solid;
  transition: background 0.1s;
}

.item:hover { background: var(--bg-card); }

.item--open { border-left-color: var(--primary-500); }
.item--closed { border-left-color: #8b8fea; }

.item__info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.item__name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item__app {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.item__time {
  font-size: 0.68rem;
  color: var(--text-secondary);
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
.item__btn--ungroup:hover:not(:disabled) { color: #f59e0b; border-color: #f59e0b; }
.item__btn--delete:hover:not(:disabled) { color: var(--error-500); border-color: var(--error-500); }
.item__btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

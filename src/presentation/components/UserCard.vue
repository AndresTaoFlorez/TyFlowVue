<script setup>
defineProps({
  user: { type: Object, required: true },
  toggling: { type: Boolean, default: false },
  loadingEdit: { type: Boolean, default: false },
})

defineEmits(['toggle', 'edit'])
</script>

<template>
  <div class="user-card" :class="{ 'user-card--inactive': !user.isActive }">
    <div class="user-card__header">
      <div class="user-card__avatar">
        <i class='bx bx-user'></i>
      </div>
      <div class="user-card__identity">
        <h3 class="user-card__name">{{ user.fullName }}</h3>
        <span class="user-card__email">{{ user.email || '—' }}</span>
      </div>
      <span v-if="user.isActive" class="status-badge status-badge--active">Activo</span>
      <span v-else class="status-badge status-badge--inactive">Inactivo</span>
    </div>

    <div class="user-card__body">
      <div class="user-card__field">
        <i class='bx bx-id-card'></i>
        <span>{{ user.documentNumber }}</span>
      </div>
      <div class="user-card__field">
        <i class='bx bx-shield'></i>
        <div class="user-card__tags">
          <template v-if="user.roleNames.length">
            <span v-for="rol in user.roleNames" :key="rol" class="role-tag">{{ rol }}</span>
          </template>
          <span v-else class="user-card__na">N/A</span>
        </div>
      </div>
      <div class="user-card__field" v-if="user.supportLevelNames.length">
        <i class='bx bx-layer'></i>
        <div class="user-card__tags">
          <span v-for="level in user.supportLevelNames" :key="level" class="level-tag">{{ level }}</span>
        </div>
      </div>
    </div>

    <div class="user-card__actions">
      <button
        class="btn-toggle"
        :class="[toggling ? 'btn-toggle--loading' : (user.isActive ? 'btn-toggle--active' : 'btn-toggle--inactive')]"
        @click="$emit('toggle', user.id)"
        :title="user.isActive ? 'Desactivar' : 'Activar'"
        :disabled="toggling"
      >
        <i :class="toggling ? 'bx bx-loader-alt bx-spin' : (user.isActive ? 'bx bx-toggle-right' : 'bx bx-toggle-left')"></i>
      </button>
      <button class="btn-icon-small" @click="$emit('edit', user)" :title="user.isActive ? 'Editar' : 'Ver detalle'" :disabled="loadingEdit">
        <i :class="loadingEdit ? 'bx bx-loader-alt bx-spin' : (user.isActive ? 'bx bx-edit-alt' : 'bx bx-show')"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.user-card {
  background: white;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 1rem 1.25rem 0.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: box-shadow 0.2s;
}

.user-card:hover {
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.1));
}

.user-card--inactive {
  opacity: 0.65;
}

.user-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-card__avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-full, 50%);
  background: var(--bg-card, #f3f4f6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.user-card__identity {
  flex: 1;
  min-width: 0;
}

.user-card__name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-card__email {
  font-size: 0.78rem;
  color: var(--text-secondary);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.user-card__field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: var(--text-primary);
  min-height: 1.5rem;
}

.user-card__field > i {
  color: var(--text-secondary);
  font-size: 1rem;
  flex-shrink: 0;
  width: 1rem;
  text-align: center;
}

.user-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.user-card__na {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.user-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid var(--border-light);
  padding-top: 0.4rem;
  margin-top: auto;
}

.status-badge {
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}

.status-badge--active {
  background-color: var(--success-bg);
  color: var(--success-text);
}

.status-badge--inactive {
  background-color: var(--error-bg);
  color: var(--error-text);
}

.role-tag, .level-tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}

.role-tag {
  background: #E0E7FF;
  color: #3730A3;
}

.level-tag {
  background: #DBEAFE;
  color: #1E40AF;
}

.btn-toggle {
  background: transparent;
  font-size: 1.4rem;
  padding: 0.3rem;
  border-radius: 4px;
  transition: color 0.2s, background-color 0.2s;
  cursor: pointer;
}

.btn-toggle--active { color: var(--success-text, #16a34a); }
.btn-toggle--active:hover { background-color: var(--success-bg, #f0fdf4); }
.btn-toggle--inactive { color: var(--error-text, #dc2626); }
.btn-toggle--inactive:hover { background-color: var(--error-bg, #fef2f2); }
.btn-toggle--loading { color: var(--text-secondary); opacity: 0.6; cursor: not-allowed; }

.btn-icon-small {
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  padding: 0.3rem;
  border-radius: 4px;
  transition: 0.2s;
}

.btn-icon-small:hover:not(:disabled) {
  color: var(--primary-500);
  background-color: var(--bg-card);
}

.btn-icon-small:disabled {
  color: var(--primary-500);
  opacity: 0.7;
  cursor: not-allowed;
}
</style>

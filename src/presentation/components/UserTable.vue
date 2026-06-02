<script setup>
defineProps({
  users: { type: Array, required: true },
  toggling: { type: Set, required: true },
  loadingEditId: { type: String, default: null },
})

defineEmits(['toggle', 'edit'])
</script>

<template>
  <div class="table-container">
    <table class="datatable">
      <thead>
        <tr class="datatable__header">
          <th>Estado</th>
          <th>Nombre Completo</th>
          <th>Documento</th>
          <th>Correo</th>
          <th>Rol</th>
          <th>Nivel</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id" class="datatable__row">
          <td>
            <span v-if="user.isActive" class="status-badge status-badge--active">Activo</span>
            <span v-else class="status-badge status-badge--inactive">Inactivo</span>
          </td>
          <td class="datatable__cell--bold">{{ user.fullName }}</td>
          <td>{{ user.documentNumber }}</td>
          <td>{{ user.email || '—' }}</td>
          <td>
            <template v-if="user.roleNames.length">
              <span v-for="rol in user.roleNames" :key="rol" class="role-tag">{{ rol }}</span>
            </template>
            <span v-else>N/A</span>
          </td>
          <td>
            <template v-if="user.supportLevelNames.length">
              <span v-for="level in user.supportLevelNames" :key="level" class="level-tag">{{ level }}</span>
            </template>
            <span v-else>—</span>
          </td>
          <td>
            <button
              class="btn-toggle"
              :class="[toggling.has(user.id) ? 'btn-toggle--loading' : (user.isActive ? 'btn-toggle--active' : 'btn-toggle--inactive')]"
              @click="$emit('toggle', user.id)"
              :title="user.isActive ? 'Desactivar' : 'Activar'"
              :disabled="toggling.has(user.id)"
            >
              <i :class="toggling.has(user.id) ? 'bx bx-loader-alt bx-spin' : (user.isActive ? 'bx bx-toggle-right' : 'bx bx-toggle-left')"></i>
            </button>
            <button class="btn-icon-small" @click="$emit('edit', user)" :title="user.isActive ? 'Editar' : 'Ver detalle'" :disabled="loadingEditId === user.id">
              <i :class="loadingEditId === user.id ? 'bx bx-loader-alt bx-spin' : (user.isActive ? 'bx bx-edit-alt' : 'bx bx-show')"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-container {
  background: var(--bg-main);
  border-radius: var(--radius-md);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
}

.datatable {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.datatable th, .datatable td {
  padding: 1rem;
  border-bottom: 1px solid var(--border-light);
}

.datatable__header {
  color: var(--text-secondary);
  font-weight: 600;
  background-color: var(--bg-card);
}

.datatable__row:hover {
  background-color: var(--bg-card);
}

.datatable__cell--bold {
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
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
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0.15rem;
}

.role-tag {
  background: var(--tag-role-bg);
  color: var(--tag-role-text);
}

.level-tag {
  background: var(--tag-level-bg);
  color: var(--tag-level-text);
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

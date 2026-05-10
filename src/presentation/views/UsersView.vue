<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/presentation/stores/useUserStore'

const userStore = useUserStore()

const mostrarModal = ref(false)
const cargando = ref(false)
const errores = ref({})

const nuevoUsuario = ref({
  firstName: '', secondName: '',
  firstSurname: '', secondSurname: '',
  documentNumber: '',
})

const cerrarModal = () => {
  mostrarModal.value = false
  errores.value = {}
  nuevoUsuario.value = {
    firstName: '', secondName: '',
    firstSurname: '', secondSurname: '',
    documentNumber: '',
  }
}

const validarFormulario = () => {
  errores.value = {}
  let esValido = true
  if (nuevoUsuario.value.documentNumber.length < 5) {
    errores.value.documentNumber = 'Documento demasiado corto.'
    esValido = false
  }
  return esValido
}

const guardarUsuario = async () => {
  if (!validarFormulario()) return

  cargando.value = true
  try {
    await userStore.createUser(nuevoUsuario.value)
    cerrarModal()
  } catch (error) {
    alert('Error al guardar: ' + error.message)
  } finally {
    cargando.value = false
  }
}

const toggleEstado = async (userId) => {
  try {
    await userStore.toggleStatus(userId)
  } catch (error) {
    alert('Error al cambiar estado: ' + error.message)
  }
}

onMounted(() => {
  userStore.loadUsers()
  userStore.loadSelects()
})
</script>

<template>
  <section class="content">

    <!-- Cabecera -->
    <div class="page-header">
      <h1 class="page-header__title">Registro de Usuarios</h1>
      <button @click="mostrarModal = true" class="btn-primary">
        <i class='bx bx-plus'></i> Crear nuevo usuario
      </button>
    </div>

    <!-- Buscador -->
    <div class="filter-bar">
      <div class="filter-bar__group">
        <i class='bx bx-search filter-bar__icon'></i>
        <input type="text" class="filter-bar__input" placeholder="Buscar por nombre...">
      </div>
      <div class="filter-bar__group">
        <i class='bx bx-envelope filter-bar__icon'></i>
        <input type="text" class="filter-bar__input" placeholder="Buscar por correo...">
      </div>
    </div>

    <!-- Tabla -->
    <div class="table-container">
      <table class="datatable">
        <thead>
          <tr class="datatable__header">
            <th>Estado</th>
            <th>Nombre Completo</th>
            <th>Documento</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Area</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in userStore.users" :key="user.id" class="datatable__row">
            <td>
              <span v-if="user.isActive" class="status-badge status-badge--active">Activo</span>
              <span v-else class="status-badge status-badge--inactive">Inactivo</span>
            </td>
            <td class="datatable__cell--bold">{{ user.fullName }}</td>
            <td>{{ user.documentNumber }}</td>
            <td>{{ user.email || '—' }}</td>
            <td><span class="role-tag">{{ user.roleName || 'N/A' }}</span></td>
            <td>{{ user.areaName || 'N/A' }}</td>
            <td>
              <button class="btn-icon-small" @click="toggleEstado(user.id)" :title="user.isActive ? 'Desactivar' : 'Activar'">
                <i :class="user.isActive ? 'bx bx-toggle-right' : 'bx bx-toggle-left'"></i>
              </button>
              <button class="btn-icon-small">
                <i class='bx bx-edit-alt'></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Crear Usuario -->
    <div v-if="mostrarModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Registrar Nuevo Usuario</h2>
          <button @click="cerrarModal" class="btn-close"><i class='bx bx-x'></i></button>
        </div>

        <form @submit.prevent="guardarUsuario" class="modal-form">
          <div class="form-grid">
            <div class="form-group">
              <label>Primer Nombre *</label>
              <input v-model="nuevoUsuario.firstName" type="text" required class="form-input">
            </div>
            <div class="form-group">
              <label>Segundo Nombre</label>
              <input v-model="nuevoUsuario.secondName" type="text" class="form-input">
            </div>
            <div class="form-group">
              <label>Primer Apellido *</label>
              <input v-model="nuevoUsuario.firstSurname" type="text" required class="form-input">
            </div>
            <div class="form-group">
              <label>Segundo Apellido</label>
              <input v-model="nuevoUsuario.secondSurname" type="text" class="form-input">
            </div>
            <div class="form-group">
              <label>Numero de Documento *</label>
              <input v-model="nuevoUsuario.documentNumber" type="text" required class="form-input"
                :class="{ 'input-error': errores.documentNumber }">
              <span v-if="errores.documentNumber" class="error-text">{{ errores.documentNumber }}</span>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" @click="cerrarModal" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="cargando">
              {{ cargando ? 'Guardando...' : 'Guardar Usuario' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </section>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.filter-bar {
  display: flex;
  gap: 1rem;
  background: white;
  padding: 1rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.filter-bar__group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-light);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-sm);
  flex: 1;
  background-color: var(--bg-main);
}

.filter-bar__icon {
  color: var(--text-secondary);
  font-size: 1.2rem;
}

.filter-bar__input {
  border: none;
  outline: none;
  width: 100%;
  color: var(--text-primary);
  background: transparent;
}

.table-container {
  background: white;
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
  background-color: #f9fafb;
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

.role-tag {
  background: #E0E7FF;
  color: #3730A3;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-icon-small {
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  padding: 0.3rem;
  border-radius: 4px;
  transition: 0.2s;
}

.btn-icon-small:hover {
  color: var(--primary-500);
  background-color: var(--bg-card);
}

.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--bg-main); width: 100%; max-width: 600px;
  border-radius: var(--radius-lg); padding: 2rem;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;
}

.btn-close {
  background: transparent; font-size: 1.5rem; color: var(--text-secondary);
}

.modal-form {
  display: flex; flex-direction: column; gap: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3rem; display: block;
}

.form-input {
  width: 100%; padding: 0.8rem; border: 1px solid var(--border-light); border-radius: var(--radius-md);
}

.form-input:focus {
  outline: none; border-color: var(--primary-500);
}

.modal-actions {
  display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;
}

.input-error {
  border-color: var(--error-500) !important;
  background-color: #FEF2F2;
}

.error-text {
  color: var(--error-500);
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.3rem;
  display: block;
}
</style>

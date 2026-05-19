<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'
import SkeletonCard from '@/presentation/components/SkeletonCard.vue'
import UserTable from '@/presentation/components/UserTable.vue'
import UserCardGrid from '@/presentation/components/UserCardGrid.vue'
import ToastNotification from '@/presentation/components/ToastNotification.vue'

const userStore = useUserStore()
const authStore = useAuthStore()
const router = useRouter()

const busqueda = ref('')

const currentUserId = computed(() => authStore.profile?.id)

const usuariosFiltrados = computed(() => {
  const sinActual = userStore.users.filter(u => u.id !== currentUserId.value)
  const termino = busqueda.value.toLowerCase().trim()
  if (!termino) return sinActual
  return sinActual.filter(u =>
    u.fullName.toLowerCase().includes(termino) ||
    (u.email || '').toLowerCase().includes(termino) ||
    (u.documentNumber || '').toLowerCase().includes(termino)
  )
})

const mostrarModal = ref(false)
const modoEdicion = ref(false)
const modoVista = ref(false)
const editandoUserId = ref(null)
const cargando = ref(false)
const toggling = ref(new Set())
const cargandoEditar = ref(null)
const emailOriginal = ref('')
const confirmandoEmail = ref(false)
const vistaCards = ref(true)
const errores = ref({})
const toastVisible = ref(false)
const toastMessage = ref('')

const formulario = ref({
  firstName: '', secondName: '',
  firstSurname: '', secondSurname: '',
  documentNumber: '',
  email: '',
  password: '',
  roleIds: [],
  supportLevelIds: [],
})

const abrirCrear = () => {
  modoEdicion.value = false
  editandoUserId.value = null
  formulario.value = {
    firstName: '', secondName: '',
    firstSurname: '', secondSurname: '',
    documentNumber: '',
    email: '',
    password: '',
    roleIds: [],
    supportLevelIds: [],
  }
  mostrarModal.value = true
}

const resolverIds = (nombresCsv, lista) => {
  if (!nombresCsv) return []
  const nombres = nombresCsv.split(',').map(n => n.trim().toLowerCase())
  return lista
    .filter(item => nombres.includes((item.displayName || item.name || '').toLowerCase()))
    .map(item => item.id)
}

const abrirEditar = async (user) => {
  if (cargandoEditar.value) return
  cargandoEditar.value = user.id
  try {
    modoVista.value = !user.isActive
    modoEdicion.value = user.isActive
    editandoUserId.value = user.id
    await userStore.loadSelects()
    emailOriginal.value = user.email || ''
    formulario.value = {
      firstName: user.firstName || '',
      secondName: user.secondName || '',
      firstSurname: user.firstSurname || '',
      secondSurname: user.secondSurname || '',
      documentNumber: user.documentNumber || '',
      email: user.email || '',
      roleIds: resolverIds(user.roleName, userStore.roles),
      supportLevelIds: resolverIds(user.supportLevelName, userStore.supportLevels),
    }
    mostrarModal.value = true
  } finally {
    cargandoEditar.value = null
  }
}

const cerrarModal = () => {
  mostrarModal.value = false
  modoEdicion.value = false
  modoVista.value = false
  editandoUserId.value = null
  confirmandoEmail.value = false
  errores.value = {}
}

const validarFormulario = () => {
  errores.value = {}
  let esValido = true
  if (formulario.value.documentNumber.length < 5) {
    errores.value.documentNumber = 'Documento demasiado corto.'
    esValido = false
  }
  if (!modoEdicion.value && formulario.value.password.length < 6) {
    errores.value.password = 'La contraseña debe tener al menos 6 caracteres.'
    esValido = false
  }
  if (formulario.value.roleIds.length === 0) {
    errores.value.roles = 'Debe seleccionar al menos un rol.'
    esValido = false
  }
  return esValido
}

const emailCambio = computed(() =>
  modoEdicion.value &&
  formulario.value.email.trim().toLowerCase() !== emailOriginal.value.trim().toLowerCase()
)

const esEdicionPropia = computed(() =>
  editandoUserId.value === authStore.profile?.id
)

const guardarUsuario = async () => {
  if (modoVista.value) return
  if (!validarFormulario()) return

  // Paso de confirmación si se cambió el correo
  if (emailCambio.value && !confirmandoEmail.value) {
    confirmandoEmail.value = true
    return
  }

  const cambioEmailPropio = emailCambio.value && esEdicionPropia.value
  cargando.value = true
  try {
    const esEdicion = modoEdicion.value
    if (esEdicion) {
      await userStore.updateUser(editandoUserId.value, formulario.value, {
        emailChanged: emailCambio.value,
        skipReload: cambioEmailPropio,
      })
    } else {
      await userStore.createUser(formulario.value)
    }
    cerrarModal()

    if (cambioEmailPropio) {
      authStore.logout()
      router.push('/')
      return
    }

    toastMessage.value = esEdicion ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.'
    toastVisible.value = true
  } catch (error) {
    // Si cambió su propio email y el PUT fue exitoso pero algo posterior falló,
    // el token ya es inválido — cerrar sesión directamente
    if (cambioEmailPropio) {
      cerrarModal()
      authStore.logout()
      router.push('/')
      return
    }
    confirmandoEmail.value = false
    if (error.isConflict) {
      errores.value.email = 'Este correo ya está registrado.'
    } else if (error.isForbidden) {
      errores.value.general = 'No tienes permisos para editar este usuario.'
    } else if (error.isNotFound) {
      errores.value.general = 'Un rol o nivel seleccionado no existe.'
    } else if (error.hasFieldErrors) {
      errores.value = { ...errores.value, ...error.fields }
    } else {
      errores.value.general = error.userMessage || error.message
    }
  } finally {
    cargando.value = false
  }
}

const cancelarConfirmacion = () => {
  confirmandoEmail.value = false
}

const toggleEstado = async (userId) => {
  if (toggling.value.has(userId)) return
  toggling.value.add(userId)
  try {
    await userStore.toggleStatus(userId)
  } catch (error) {
    alert('Error al cambiar estado: ' + error.message)
  } finally {
    toggling.value.delete(userId)
  }
}

const onEsc = (e) => { if (e.key === 'Escape' && mostrarModal.value) cerrarModal() }

onMounted(() => {
  userStore.loadUsers()
  userStore.loadSelects()
  window.addEventListener('keydown', onEsc)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <section class="content">

    <!-- Cabecera -->
    <div class="page-header">
      <h1 class="page-header__title">Registro de Usuarios</h1>
      <button @click="abrirCrear" class="btn-create">
        <i class='bx bx-plus'></i> <span class="btn-create__label">Crear nuevo usuario</span><span class="btn-create__short">Nuevo</span>
      </button>
    </div>

    <!-- Buscador -->
    <div class="filter-bar">
      <div class="filter-bar__group">
        <i class='bx bx-search filter-bar__icon'></i>
        <input v-model="busqueda" type="text" class="filter-bar__input" placeholder="Buscar por nombre, correo o número de identificación...">
      </div>
      <!-- change between table and cards view -->
      <button class="btn-view-toggle" @click="vistaCards = !vistaCards" :title="vistaCards ? 'Ver como tabla' : 'Ver como cards'">
        <i :class="vistaCards ? 'bx bx-table' : 'bx bx-grid-alt'"></i>
      </button>
    </div>

    <!-- Skeleton loading -->
    <SkeletonCard v-if="userStore.loading" :count="6" />

    <!-- Tabla -->
    <UserTable
      v-else-if="!vistaCards"
      :users="usuariosFiltrados"
      :toggling="toggling"
      :loading-edit-id="cargandoEditar"
      @toggle="toggleEstado"
      @edit="abrirEditar"
    />

    <!-- Cards -->
    <UserCardGrid
      v-else
      :users="usuariosFiltrados"
      :toggling="toggling"
      :loading-edit-id="cargandoEditar"
      @toggle="toggleEstado"
      @edit="abrirEditar"
    />

    <!-- Modal Crear Usuario -->
    <div v-if="mostrarModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ modoVista ? 'Detalle de Usuario' : (modoEdicion ? 'Editar Usuario' : 'Registrar Nuevo Usuario') }}</h2>
          <span v-if="modoVista" class="status-badge status-badge--inactive">Inactivo</span>
          <button @click="cerrarModal" class="btn-close"><i class='bx bx-x'></i></button>
        </div>

        <form @submit.prevent="guardarUsuario" class="modal-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label>Primer Nombre {{ modoVista ? '' : '*' }}</label>
              <input v-model="formulario.firstName" type="text" :required="!modoVista" class="form-input" :disabled="modoVista">
            </div>
            <div class="form-group">
              <label>Segundo Nombre</label>
              <input v-model="formulario.secondName" type="text" class="form-input" :disabled="modoVista">
            </div>
            <div class="form-group">
              <label>Primer Apellido {{ modoVista ? '' : '*' }}</label>
              <input v-model="formulario.firstSurname" type="text" :required="!modoVista" class="form-input" :disabled="modoVista">
            </div>
            <div class="form-group">
              <label>Segundo Apellido</label>
              <input v-model="formulario.secondSurname" type="text" class="form-input" :disabled="modoVista">
            </div>
            <div class="form-group">
              <label>Numero de Documento {{ modoVista ? '' : '*' }}</label>
              <input v-model="formulario.documentNumber" type="text" :required="!modoVista" class="form-input"
                :disabled="modoVista" :class="{ 'input-error': errores.documentNumber }">
              <span v-if="errores.documentNumber" class="error-text">{{ errores.documentNumber }}</span>
            </div>
            <div class="form-group">
              <label>Correo electrónico {{ (!modoEdicion && !modoVista) ? '*' : '' }}</label>
              <input v-model="formulario.email" type="email" class="form-input" placeholder="correo@ejemplo.com"
                :required="!modoEdicion && !modoVista" :disabled="modoVista" :class="{ 'input-error': errores.email }" autocomplete="new-email">
              <span v-if="errores.email" class="error-text">{{ errores.email }}</span>
              <span v-else-if="modoEdicion" class="hint-text">Si se cambia, el usuario recibirá un correo de confirmación.</span>
            </div>
            <div v-if="!modoEdicion && !modoVista" class="form-group">
              <label>Contraseña *</label>
              <input v-model="formulario.password" type="password" class="form-input" placeholder="Mínimo 6 caracteres"
                required :class="{ 'input-error': errores.password }" autocomplete="new-password">
              <span v-if="errores.password" class="error-text">{{ errores.password }}</span>
            </div>
            <div class="form-group">
              <label>Roles *</label>
              <div v-if="userStore.loadingSelects" class="checkbox-group checkbox-group--loading">
                <i class='bx bx-loader-alt bx-spin'></i> Cargando roles...
              </div>
              <template v-else>
                <div class="checkbox-group" :class="{ 'input-error': errores.roles }">
                  <label v-for="role in userStore.roles" :key="role.id" class="checkbox-label">
                    <input type="checkbox" :value="role.id" v-model="formulario.roleIds" :disabled="modoVista">
                    {{ role.name }}
                  </label>
                </div>
                <span v-if="errores.roles" class="error-text">{{ errores.roles }}</span>
              </template>
            </div>
            <div class="form-group">
              <label>Niveles</label>
              <div v-if="userStore.loadingSelects" class="checkbox-group checkbox-group--loading">
                <i class='bx bx-loader-alt bx-spin'></i> Cargando niveles...
              </div>
              <div v-else class="checkbox-group">
                <label v-for="level in userStore.supportLevels" :key="level.id" class="checkbox-label">
                  <input type="checkbox" :value="level.id" v-model="formulario.supportLevelIds" :disabled="modoVista">
                  {{ level.name }}
                </label>
              </div>
            </div>
          </div>

          <div v-if="errores.general" class="form-error-banner">
            <i class='bx bx-error-circle'></i>
            <span>{{ errores.general }}</span>
          </div>

          <!-- Confirmación de cambio de correo -->
          <div v-if="confirmandoEmail" class="confirm-banner">
            <div class="confirm-banner__icon">
              <i class='bx bx-envelope'></i>
            </div>
            <div class="confirm-banner__body">
              <p class="confirm-banner__title">Cambio de correo electrónico</p>
              <p class="confirm-banner__text">
                El correo cambiará a <strong>{{ formulario.email }}</strong>.
                <template v-if="esEdicionPropia">Tu sesión se cerrará y deberás iniciar sesión con el nuevo correo.</template>
                <template v-else>El usuario deberá iniciar sesión con el nuevo correo.</template>
              </p>
            </div>
          </div>

          <div class="modal-actions">
            <button v-if="modoVista" type="button" @click="cerrarModal" class="btn-secondary">Cerrar</button>
            <template v-else-if="confirmandoEmail">
              <button type="button" @click="cancelarConfirmacion" class="btn-secondary" :disabled="cargando">Volver</button>
              <button type="submit" class="btn-primary btn-primary--warning" :class="{ 'btn-primary--loading': cargando }" :disabled="cargando">
                <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
                <i v-else class='bx bx-check'></i>
                {{ cargando ? 'Guardando...' : 'Confirmar cambio' }}
              </button>
            </template>
            <template v-else>
              <button type="button" @click="cerrarModal" class="btn-secondary" :disabled="cargando">Cancelar</button>
              <button type="submit" class="btn-primary" :class="{ 'btn-primary--loading': cargando }" :disabled="cargando">
                <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
                {{ cargando ? 'Guardando...' : (modoEdicion ? 'Actualizar' : 'Guardar Usuario') }}
              </button>
            </template>
          </div>
        </form>
      </div>
    </div>

    <ToastNotification
      :visible="toastVisible"
      :message="toastMessage"
      @close="toastVisible = false"
    />

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
  align-items: center;
  justify-content: space-between;
}

.page-header__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-create {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem 0.8rem;
  background-color: var(--primary-500);
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 1px 3px rgba(42, 199, 143, 0.3);
}

.btn-create:hover {
  background-color: var(--primary-600);
  box-shadow: 0 3px 8px rgba(42, 199, 143, 0.35);
}

.btn-create:active {
  transform: scale(0.97);
}

.btn-create i {
  font-size: 1.2rem;
}

.btn-create__short {
  display: none;
}

@media (max-width: 768px) {
  .btn-create__label { display: none; }
  .btn-create__short { display: inline; }

  .modal-overlay {
    padding: 1rem 0.5rem;
    align-items: flex-start;
  }
  .modal-content {
    padding: 1.25rem;
    margin: 0 auto;
    max-height: none;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .cards-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .page-header__title { font-size: 1.2rem; }
  .modal-content {
    padding: 1rem;
    border-radius: var(--radius-md);
  }
}

.btn-view-toggle {
  background: white;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-size: 1.25rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  display: flex;
  align-items: center;
}

.btn-view-toggle:hover {
  color: var(--primary-500);
  border-color: var(--primary-500);
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

.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center;
  z-index: 100;
  overflow-y: auto;
  padding: 2rem 1rem;
}

.modal-content {
  background: var(--bg-main); width: 100%; max-width: 600px;
  border-radius: var(--radius-lg); padding: 2rem;
  box-shadow: var(--shadow-lg);
  margin: auto;
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

.form-error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--error-bg);
  color: var(--error-text);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  border-left: 3px solid var(--error-500);
}

.form-error-banner i {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.confirm-banner {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background-color: #FFF7ED;
  border-radius: var(--radius-md);
  border-left: 3px solid #F59E0B;
}

.confirm-banner__icon {
  font-size: 1.4rem;
  color: #D97706;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.confirm-banner__title {
  font-weight: 700;
  font-size: 0.85rem;
  color: #92400E;
  margin-bottom: 0.25rem;
}

.confirm-banner__text {
  font-size: 0.82rem;
  color: #78350F;
  line-height: 1.4;
}

.btn-primary--warning {
  background-color: #F59E0B;
}

.btn-primary--warning:hover:not(:disabled) {
  background-color: #D97706;
}

.modal-actions {
  display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: white;
}

.checkbox-group--loading {
  align-items: center;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}

.checkbox-label:hover {
  background-color: var(--bg-card);
}

.checkbox-label input[type="checkbox"] {
  accent-color: var(--primary-500);
  width: 1rem;
  height: 1rem;
  cursor: pointer;
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

.hint-text {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
  display: block;
}

.form-input:disabled,
.checkbox-label input:disabled {
  background-color: var(--bg-card, #f3f4f6);
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.7;
}

.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge--inactive {
  background-color: var(--error-bg);
  color: var(--error-text);
}

</style>

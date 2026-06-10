<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useRouter } from 'vue-router'
import SkeletonCard from '@/presentation/components/layout/SkeletonCard.vue'
import UserTable from '@/presentation/components/users/UserTable.vue'
import UserCardGrid from '@/presentation/components/users/UserCardGrid.vue'
import ToastNotification from '@/presentation/components/layout/ToastNotification.vue'
import SpecialistFields from '@/presentation/components/users/SpecialistFields.vue'
import SpecialistCategoryConfig from '@/presentation/components/users/SpecialistCategoryConfig.vue'
import ChipSelect from '@/presentation/components/shared/ChipSelect.vue'
import { usePendingFields } from '@/presentation/composables/usePendingFields'

const userStore = useUserStore()
const authStore = useAuthStore()
const router = useRouter()
const { hasChanges } = usePendingFields()

const busqueda = ref('')
const ordenamiento = ref('rol-nombre')
const mostrarDropdownOrden = ref(false)

const ROLE_PRIORITY = { admin: 0, supervisor: 1, agente: 2 }

function getRolePriority(user) {
  const roles = (user.roleNames || []).map(r => r.toLowerCase())
  let best = 99
  for (const r of roles) {
    if (ROLE_PRIORITY[r] !== undefined && ROLE_PRIORITY[r] < best) best = ROLE_PRIORITY[r]
  }
  return best
}

const currentUserId = computed(() => authStore.profile?.id)

const usuariosFiltrados = computed(() => {
  const sinActual = userStore.users.filter(u => u.id !== currentUserId.value)
  const termino = busqueda.value.toLowerCase().trim()
  const filtrados = !termino
    ? [...sinActual]
    : sinActual.filter(u =>
        u.fullName.toLowerCase().includes(termino) ||
        (u.email || '').toLowerCase().includes(termino) ||
        (u.documentNumber || '').toLowerCase().includes(termino)
      )

  const orden = ordenamiento.value
  if (orden === 'alfabetico') {
    filtrados.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
  } else if (orden === 'rol') {
    filtrados.sort((a, b) => getRolePriority(a) - getRolePriority(b))
  } else {
    filtrados.sort((a, b) => {
      const diff = getRolePriority(a) - getRolePriority(b)
      return diff !== 0 ? diff : a.fullName.localeCompare(b.fullName, 'es')
    })
  }
  return filtrados
})

const mostrarModal = ref(false)
const modoEdicion = ref(false)
const modoVista = ref(false)
const editandoUserId = ref(null)
const cargando = ref(false)
const sccRef = ref(null)
// True cuando SpecialistCategoryConfig reporta cambios de categorías (para que
// el botón Actualizar se habilite aunque no cambien los demás campos).
const categoriasDirty = ref(false)
const toggling = ref(new Set())
const cargandoEditar = ref(null)
const emailOriginal = ref('')
const confirmandoEmail = ref(false)
const vistaCards = ref(true)
const errores = ref({})
const toastVisible = ref(false)
const toastMessage = ref('')
const formularioOriginal = ref({})

const formulario = ref({
  firstName: '', secondName: '',
  firstSurname: '', secondSurname: '',
  documentNumber: '',
  email: '',
  password: '',
  roleIds: [],
  applicationLevels: [],
})

const editandoUser = ref(null)
// Embedded categories from the user's specialist_profile, keyed by `${app}_${level}`.
// Seeds SpecialistCategoryConfig so it doesn't refetch categories/exclusions.
const initialCategories = ref({})

const resolveRoleNames = (roleIds) =>
  roleIds
    .map(id => userStore.roles.find(r => r.id === id)?.name)
    .filter(Boolean)

function buildInitialCategories(assignments) {
  const map = {}
  for (const a of assignments || []) {
    map[`${a.application_id}_${a.support_level_id}`] = a.support_categories || []
  }
  return map
}

const specialistRoleId = computed(() => {
  const role = userStore.roles.find(r => r.name.toLowerCase() === 'specialist')
  return role?.id ?? null
})

const esSpecialista = computed(() =>
  specialistRoleId.value !== null && formulario.value.roleIds.includes(specialistRoleId.value)
)

// El usuario tiene un registro de especialista DESACTIVADO (rol retirado, datos
// preservados). Se muestra siempre como advertencia mientras se edita.
const specialistDesactivado = computed(() =>
  !!editandoUser.value?.specialistId && editandoUser.value?.specialistIsActive === false
)

const abrirCrear = async () => {
  modoEdicion.value = false
  editandoUserId.value = null
  editandoUser.value = null
  initialCategories.value = {}
  categoriasDirty.value = false
  formulario.value = {
    firstName: '', secondName: '',
    firstSurname: '', secondSurname: '',
    documentNumber: '',
    email: '',
    password: '',
    roleIds: [],
    applicationLevels: [],
  }
  mostrarModal.value = true
  await userStore.loadSelects()
}

const resolverIds = (nombres, lista) => {
  if (!nombres || !nombres.length) return []
  const nombresLower = nombres.map(n => n.trim().toLowerCase())
  return lista
    .filter(item => nombresLower.includes((item.displayName || item.name || '').toLowerCase()))
    .map(item => item.id)
}

const abrirEditar = async (user) => {
  if (cargandoEditar.value) return
  cargandoEditar.value = user.id
  try {
    modoVista.value = !user.isActive
    modoEdicion.value = user.isActive
    editandoUserId.value = user.id
    editandoUser.value = user
    initialCategories.value = buildInitialCategories(user.applicationAssignments)
    categoriasDirty.value = false
    await userStore.loadSelects()
    emailOriginal.value = user.email || ''

    const appLevels = user.applicationAssignments.map(a => ({
      application_id: a.application_id,
      support_level_id: a.support_level_id,
    }))

    formulario.value = {
      firstName: user.firstName || '',
      secondName: user.secondName || '',
      firstSurname: user.firstSurname || '',
      secondSurname: user.secondSurname || '',
      documentNumber: user.documentNumber || '',
      email: user.email || '',
      roleIds: resolverIds(user.roleNames, userStore.roles),
      applicationLevels: appLevels,
    }
    // Si el usuario es specialist ACTIVO en la BD, asegurar que el rol esté
    // marcado. Un registro desactivado (rol retirado, datos preservados) NO debe
    // re-agregar el rol automáticamente: hay que dejar que el admin lo decida.
    if (user.specialistId && user.specialistIsActive && specialistRoleId.value && !formulario.value.roleIds.includes(specialistRoleId.value)) {
      formulario.value.roleIds.push(specialistRoleId.value)
    }
    formularioOriginal.value = JSON.parse(JSON.stringify(formulario.value))
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
  editandoUser.value = null
  initialCategories.value = {}
  categoriasDirty.value = false
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
  if (esSpecialista.value) {
    const levels = formulario.value.applicationLevels
    if (levels.length === 0) {
      errores.value.applicationLevels = 'Agrega al menos una aplicación con su nivel de soporte.'
      esValido = false
    } else if (levels.some(al => !al.application_id || !al.support_level_id)) {
      errores.value.applicationLevels = 'Completa todas las asignaciones o elimina las incompletas.'
      esValido = false
    }
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
  if (modoEdicion.value && !hasChanges(formularioOriginal.value, formulario.value) && !categoriasDirty.value) {
    cerrarModal()
    return
  }

  // Paso de confirmación si se cambió el correo
  if (emailCambio.value && !confirmandoEmail.value) {
    confirmandoEmail.value = true
    return
  }

  const cambioEmailPropio = emailCambio.value && esEdicionPropia.value
  cargando.value = true
  try {
    const esEdicion = modoEdicion.value

    // Fold identity + roles + specialist category flags into one payload so the
    // whole user is written through a single /users call.
    const payload = {
      ...formulario.value,
      roleNames: resolveRoleNames(formulario.value.roleIds),
      // Only send the specialist section when the user actually has the role.
      // Removing the role → omit it → backend deactivates & preserves the data.
      applicationLevels: esSpecialista.value ? formulario.value.applicationLevels : [],
      categoryAssignments: esSpecialista.value ? (sccRef.value?.getCategoryAssignments?.() ?? {}) : {},
    }

    if (esEdicion) {
      await userStore.updateUser(editandoUserId.value, payload, {
        emailChanged: emailCambio.value,
        skipReload: true,
      })
    } else {
      await userStore.createUser(payload, { skipReload: true })
    }

    if (!cambioEmailPropio) await userStore.loadUsers({ force: true })
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
      errores.value.general = 'El rol seleccionado no existe.'
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

const sortDropdownRef = ref(null)
const cerrarDropdownFuera = (e) => {
  if (sortDropdownRef.value && !sortDropdownRef.value.contains(e.target)) {
    mostrarDropdownOrden.value = false
  }
}

onMounted(() => {
  userStore.loadUsers()
  userStore.loadSelects()
  window.addEventListener('keydown', onEsc)
  window.addEventListener('click', cerrarDropdownFuera)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
  window.removeEventListener('click', cerrarDropdownFuera)
})
</script>

<template>
  <section class="content">

    <Teleport to="#topbar-actions" defer>
      <button @click="abrirCrear" class="btn-create">
        <i class='bx bx-plus'></i> <span class="btn-create__label">Crear nuevo usuario</span><span class="btn-create__short">Nuevo</span>
      </button>
    </Teleport>

    <!-- Buscador -->
    <div class="filter-bar">
      <div class="filter-bar__group">
        <i class='bx bx-search filter-bar__icon'></i>
        <input v-model="busqueda" type="text" class="filter-bar__input" placeholder="Buscar por nombre, correo o número de identificación...">
      </div>
      <!-- Ordenar -->
      <div class="sort-wrapper" ref="sortDropdownRef">
        <button class="btn-view-toggle" @click.stop="mostrarDropdownOrden = !mostrarDropdownOrden" title="Ordenar">
          <i class='bx bx-sort-alt-2'></i>
        </button>
        <div v-if="mostrarDropdownOrden" class="sort-dropdown">
          <button :class="['sort-dropdown__option', { 'sort-dropdown__option--active': ordenamiento === 'alfabetico' }]" @click="ordenamiento = 'alfabetico'; mostrarDropdownOrden = false">
            <i class='bx bx-sort-a-z'></i> Alfabético
          </button>
          <button :class="['sort-dropdown__option', { 'sort-dropdown__option--active': ordenamiento === 'rol' }]" @click="ordenamiento = 'rol'; mostrarDropdownOrden = false">
            <i class='bx bx-shield'></i> Por rol
          </button>
          <button :class="['sort-dropdown__option', { 'sort-dropdown__option--active': ordenamiento === 'rol-nombre' }]" @click="ordenamiento = 'rol-nombre'; mostrarDropdownOrden = false">
            <i class='bx bx-filter'></i> Rol + Nombre
          </button>
        </div>
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
    <Transition name="uv-modal">
    <div v-if="mostrarModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ modoVista ? 'Detalle de Usuario' : (modoEdicion ? 'Editar Usuario' : 'Registrar Nuevo Usuario') }}</h2>
          <span v-if="modoVista" class="status-badge status-badge--inactive">Inactivo</span>
          <button @click="cerrarModal" class="btn-close"><i class='bx bx-x'></i></button>
        </div>

        <form @submit.prevent="guardarUsuario" class="modal-form" autocomplete="off">
          <div v-if="specialistDesactivado" class="warning-banner">
            <i class='bx bx-error'></i>
            <span>
              <template v-if="esSpecialista">
                El perfil de especialista está <strong>desactivado</strong> y se <strong>reactivará al guardar</strong>, conservando sus aplicaciones y categorías.
              </template>
              <template v-else>
                Este usuario tiene un perfil de especialista <strong>desactivado</strong>. Sus aplicaciones y categorías están preservadas; vuelve a asignar el rol <strong>Especialista</strong> para reactivarlo.
              </template>
            </span>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Primer Nombre {{ modoVista ? '' : '*' }}</label>
              <input v-model="formulario.firstName" type="text" :required="!modoVista" class="form-input" :disabled="modoVista || cargando">
            </div>
            <div class="form-group">
              <label>Segundo Nombre</label>
              <input v-model="formulario.secondName" type="text" class="form-input" :disabled="modoVista || cargando">
            </div>
            <div class="form-group">
              <label>Primer Apellido {{ modoVista ? '' : '*' }}</label>
              <input v-model="formulario.firstSurname" type="text" :required="!modoVista" class="form-input" :disabled="modoVista || cargando">
            </div>
            <div class="form-group">
              <label>Segundo Apellido</label>
              <input v-model="formulario.secondSurname" type="text" class="form-input" :disabled="modoVista || cargando">
            </div>
            <div class="form-group">
              <label>Numero de Documento {{ modoVista ? '' : '*' }}</label>
              <input v-model="formulario.documentNumber" type="text" :required="!modoVista" class="form-input"
                :disabled="modoVista || cargando" :class="{ 'input-error': errores.documentNumber }">
              <span v-if="errores.documentNumber" class="error-text">{{ errores.documentNumber }}</span>
            </div>
            <div class="form-group">
              <label>Correo electrónico {{ (!modoEdicion && !modoVista) ? '*' : '' }}</label>
              <input v-model="formulario.email" type="email" class="form-input" placeholder="correo@ejemplo.com"
                :required="!modoEdicion && !modoVista" :disabled="modoVista || cargando" :class="{ 'input-error': errores.email }" autocomplete="new-email">
              <span v-if="errores.email" class="error-text">{{ errores.email }}</span>
              <span v-else-if="modoEdicion" class="hint-text">Si se cambia, el usuario recibirá un correo de confirmación.</span>
            </div>
            <div v-if="!modoEdicion && !modoVista" class="form-group">
              <label>Contraseña *</label>
              <input v-model="formulario.password" type="password" class="form-input" placeholder="Mínimo 6 caracteres"
                required :disabled="cargando" :class="{ 'input-error': errores.password }" autocomplete="new-password">
              <span v-if="errores.password" class="error-text">{{ errores.password }}</span>
            </div>
            <div class="form-group form-group--full">
              <ChipSelect
                :options="userStore.roles"
                v-model="formulario.roleIds"
                label="Roles *"
                icon="bx-shield"
                color="amber"
                :loading="userStore.loadingSelects"
                :disabled="modoVista || cargando"
                :error="errores.roles"
                empty-text="Sin roles disponibles"
              />
            </div>
            <div v-if="esSpecialista" class="form-group form-group--full">
              <SpecialistFields
                :support-levels="userStore.supportLevels"
                :applications="userStore.applications"
                v-model="formulario.applicationLevels"
                :loading="userStore.loadingSelects"
                :disabled="modoVista || cargando"
                :error="errores.applicationLevels"
              />
            </div>
            <div
              v-if="esSpecialista && formulario.applicationLevels.some(al => al.application_id && al.support_level_id)"
              class="form-group form-group--full"
            >
              <label class="form-label">
                Categorías habilitadas
                <span class="form-hint">Según las aplicaciones y niveles asignados</span>
              </label>
              <SpecialistCategoryConfig
                ref="sccRef"
                :application-levels="formulario.applicationLevels.filter(al => al.application_id && al.support_level_id)"
                :initial-categories="initialCategories"
                :disabled="modoVista || cargando"
                @dirty-change="categoriasDirty = $event"
              />
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
              <button
                type="submit"
                class="btn-primary"
                :class="{ 'btn-primary--loading': cargando }"
                :disabled="cargando || (modoEdicion && !hasChanges(formularioOriginal, formulario) && !categoriasDirty)"
              >
                <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
                {{ cargando ? 'Guardando...' : (modoEdicion ? 'Actualizar' : 'Guardar Usuario') }}
              </button>
            </template>
          </div>
        </form>
      </div>
    </div>
    </Transition>

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
  .modal-content {
    padding: 1rem;
    border-radius: var(--radius-md);
  }
}

.btn-view-toggle {
  background: var(--bg-main);
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

.sort-wrapper {
  position: relative;
}

.sort-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: var(--bg-main);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 10rem;
  z-index: 50;
  overflow: hidden;
}

.sort-dropdown__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 1rem;
  border: none;
  background: none;
  font-size: 0.85rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
}

.sort-dropdown__option:hover {
  background-color: var(--bg-card);
}

.sort-dropdown__option--active {
  color: var(--primary-500);
  font-weight: 600;
  background-color: rgba(42, 199, 143, 0.08);
}

.sort-dropdown__option i {
  font-size: 1.1rem;
}

.filter-bar {
  display: flex;
  gap: 1rem;
  background: var(--bg-main);
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

/* Modal open/close transitions */
.uv-modal-enter-active { transition: opacity 0.18s ease; }
.uv-modal-enter-active .modal-content { animation: uv-pop-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
.uv-modal-leave-active { transition: opacity 0.15s ease; }
.uv-modal-leave-active .modal-content { animation: uv-pop-out 0.15s ease forwards; }
.uv-modal-enter-from, .uv-modal-leave-to { opacity: 0; }

@keyframes uv-pop-in {
  from { transform: scale(0.93) translateY(8px); opacity: 0; }
  to   { transform: scale(1)    translateY(0);   opacity: 1; }
}
@keyframes uv-pop-out {
  from { transform: scale(1)    translateY(0);   opacity: 1; }
  to   { transform: scale(0.93) translateY(8px); opacity: 0; }
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

.form-group--full {
  grid-column: 1 / -1;
}

.form-group label,
.form-label {
  font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3rem; display: block;
}

.form-hint {
  display: block;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

.form-input {
  width: 100%; padding: 0.8rem; border: 1px solid var(--border-light); border-radius: var(--radius-md);
  background: var(--bg-main); color: var(--text-primary);
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

.warning-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--warning-bg);
  color: var(--warning-text);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 500;
  border-left: 3px solid var(--warning-border);
  line-height: 1.4;
}

.warning-banner i {
  font-size: 1.2rem;
  flex-shrink: 0;
  color: var(--warning-icon);
}

.warning-banner strong { font-weight: 700; }

.confirm-banner {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--warning-bg);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--warning-border);
}

.confirm-banner__icon {
  font-size: 1.4rem;
  color: var(--warning-icon);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.confirm-banner__title {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--warning-title);
  margin-bottom: 0.25rem;
}

.confirm-banner__text {
  font-size: 0.82rem;
  color: var(--warning-text);
  line-height: 1.4;
}

.btn-primary--warning {
  background-color: var(--warning-btn);
}

.btn-primary--warning:hover:not(:disabled) {
  background-color: var(--warning-btn-hover);
}

.modal-actions {
  display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;
}


.input-error {
  border-color: var(--error-500) !important;
  background-color: var(--input-error-bg);
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

.form-input:disabled {
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

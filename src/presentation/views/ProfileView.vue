<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useRouter } from 'vue-router'
import ToastNotification from '@/presentation/components/ToastNotification.vue'

const authStore = useAuthStore()
const userStore = useUserStore()
const router = useRouter()
const { profile } = storeToRefs(authStore)
const { isAdmin } = storeToRefs(authStore)

const editando = ref(false)
const cargando = ref(false)
const errores = ref({})
const emailOriginal = ref('')
const confirmandoEmail = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const cargandoSelects = ref(false)

const formulario = ref({
  firstName: '', secondName: '',
  firstSurname: '', secondSurname: '',
  documentNumber: '',
  email: '',
  roleIds: [],
  supportLevelIds: [],
})

const adminRoleId = computed(() => {
  const role = userStore.roles.find(r => r.name.toLowerCase() === 'admin')
  return role?.id ?? null
})

const resolverIds = (nombresCsv, lista) => {
  if (!nombresCsv) return []
  const nombres = nombresCsv.split(',').map(n => n.trim().toLowerCase())
  return lista
    .filter(item => nombres.includes((item.name || '').toLowerCase()))
    .map(item => item.id)
}

const abrirEditar = () => {
  const p = profile.value
  emailOriginal.value = p.email || ''
  formulario.value = {
    firstName: p.firstName || '',
    secondName: p.secondName || '',
    firstSurname: p.firstSurname || '',
    secondSurname: p.secondSurname || '',
    documentNumber: p.documentNumber || '',
    email: p.email || '',
    roleIds: [],
    supportLevelIds: [],
  }
  errores.value = {}
  confirmandoEmail.value = false
  editando.value = true

  if (isAdmin.value) {
    cargandoSelects.value = true
    userStore.loadSelects().then(() => {
      formulario.value.roleIds = resolverIds(p.roleName, userStore.roles)
      formulario.value.supportLevelIds = resolverIds(p.supportLevelName, userStore.supportLevels)
    }).finally(() => {
      cargandoSelects.value = false
    })
  }
}

const cerrarEditar = () => {
  editando.value = false
  confirmandoEmail.value = false
  errores.value = {}
}

const emailCambio = () =>
  formulario.value.email.trim().toLowerCase() !== emailOriginal.value.trim().toLowerCase()

const validarFormulario = () => {
  errores.value = {}
  let valido = true
  if (formulario.value.documentNumber.length < 5) {
    errores.value.documentNumber = 'Documento demasiado corto.'
    valido = false
  }
  if (isAdmin.value && !cargandoSelects.value) {
    if (formulario.value.roleIds.length === 0) {
      errores.value.roles = 'Debe seleccionar al menos un rol.'
      valido = false
    } else if (adminRoleId.value && !formulario.value.roleIds.includes(adminRoleId.value)) {
      errores.value.roles = 'No puedes quitarte el rol de administrador.'
      valido = false
    }
  }
  return valido
}

const guardar = async () => {
  if (!validarFormulario()) return

  const cambioEmail = emailCambio()

  if (cambioEmail && !confirmandoEmail.value) {
    confirmandoEmail.value = true
    return
  }

  cargando.value = true
  try {
    const datos = { ...formulario.value }
    if (!isAdmin.value) {
      delete datos.roleIds
      delete datos.supportLevelIds
    }
    await userStore.updateMe(datos, {
      emailChanged: cambioEmail,
    })
    cerrarEditar()

    if (cambioEmail) {
      authStore.logout()
      router.push('/')
      return
    }

    await authStore.fetchProfile()
    toastMessage.value = 'Perfil actualizado correctamente.'
    toastVisible.value = true
  } catch (error) {
    if (cambioEmail) {
      cerrarEditar()
      authStore.logout()
      router.push('/')
      return
    }
    confirmandoEmail.value = false
    if (error.isConflict) {
      errores.value.email = 'Este correo ya esta registrado.'
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

const onEsc = (e) => { if (e.key === 'Escape' && editando.value) cerrarEditar() }

onMounted(() => {
  window.addEventListener('keydown', onEsc)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <section class="content">
    <div class="page-header">
      <h1 class="page-header__title">Mi Perfil</h1>
      <button v-if="profile && !editando" @click="abrirEditar" class="btn-edit">
        <i class='bx bx-edit-alt'></i> <span>Editar</span>
      </button>
    </div>

    <div class="profile-card" v-if="profile">
      <div class="profile-card__header">
        <div class="profile-card__avatar">
          <i class='bx bx-user'></i>
        </div>
        <div class="profile-card__identity">
          <h2>{{ profile.fullName }}</h2>
          <span class="profile-card__email">{{ profile.email || '—' }}</span>
        </div>
        <span v-if="profile.isActive" class="status-badge status-badge--active">Activo</span>
        <span v-else class="status-badge status-badge--inactive">Inactivo</span>
      </div>

      <div class="profile-card__body">
        <div class="profile-field">
          <span class="profile-field__label">Documento</span>
          <span class="profile-field__value">{{ profile.documentNumber }}</span>
        </div>
        <div class="profile-field">
          <span class="profile-field__label">Nombre completo</span>
          <span class="profile-field__value">
            {{ profile.firstName }}
            {{ profile.secondName ? profile.secondName + ' ' : '' }}
            {{ profile.firstSurname }}
            {{ profile.secondSurname || '' }}
          </span>
        </div>
        <div class="profile-field">
          <span class="profile-field__label">Roles</span>
          <div class="profile-field__tags">
            <template v-if="profile.roleName">
              <span v-for="rol in profile.roleName.split(', ')" :key="rol" class="role-tag">{{ rol }}</span>
            </template>
            <span v-else class="profile-field__na">Sin rol asignado</span>
          </div>
        </div>
        <div class="profile-field">
          <span class="profile-field__label">Niveles</span>
          <div class="profile-field__tags">
            <template v-if="profile.supportLevelName">
              <span v-for="level in profile.supportLevelName.split(', ')" :key="level" class="level-tag">{{ level }}</span>
            </template>
            <span v-else class="profile-field__na">Sin nivel asignado</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal editar perfil -->
    <div v-if="editando" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Editar Perfil</h2>
          <button @click="cerrarEditar" class="btn-close"><i class='bx bx-x'></i></button>
        </div>

        <form @submit.prevent="guardar" class="modal-form" autocomplete="off">
          <div class="form-grid">
            <div class="form-group">
              <label>Primer Nombre *</label>
              <input v-model="formulario.firstName" type="text" required class="form-input">
            </div>
            <div class="form-group">
              <label>Segundo Nombre</label>
              <input v-model="formulario.secondName" type="text" class="form-input">
            </div>
            <div class="form-group">
              <label>Primer Apellido *</label>
              <input v-model="formulario.firstSurname" type="text" required class="form-input">
            </div>
            <div class="form-group">
              <label>Segundo Apellido</label>
              <input v-model="formulario.secondSurname" type="text" class="form-input">
            </div>
            <div class="form-group">
              <label>Numero de Documento *</label>
              <input v-model="formulario.documentNumber" type="text" required class="form-input"
                :class="{ 'input-error': errores.documentNumber }">
              <span v-if="errores.documentNumber" class="error-text">{{ errores.documentNumber }}</span>
            </div>
            <div class="form-group">
              <label>Correo electronico</label>
              <input v-model="formulario.email" type="email" class="form-input" placeholder="correo@ejemplo.com"
                :class="{ 'input-error': errores.email }" autocomplete="new-email">
              <span v-if="errores.email" class="error-text">{{ errores.email }}</span>
              <span v-else class="hint-text">Si se cambia, tu sesion se cerrara.</span>
            </div>
            <template v-if="isAdmin">
              <div class="form-group">
                <label>Roles *</label>
                <div v-if="userStore.loadingSelects" class="checkbox-group checkbox-group--loading">
                  <i class='bx bx-loader-alt bx-spin'></i> Cargando roles...
                </div>
                <template v-else>
                  <div class="checkbox-group" :class="{ 'input-error': errores.roles }">
                    <label v-for="role in userStore.roles" :key="role.id" class="checkbox-label">
                      <input type="checkbox" :value="role.id" v-model="formulario.roleIds"
                        :disabled="adminRoleId !== null && role.id === adminRoleId">
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
                    <input type="checkbox" :value="level.id" v-model="formulario.supportLevelIds">
                    {{ level.name }}
                  </label>
                </div>
              </div>
            </template>
          </div>

          <div v-if="errores.general" class="form-error-banner">
            <i class='bx bx-error-circle'></i>
            <span>{{ errores.general }}</span>
          </div>

          <!-- Confirmacion de cambio de correo -->
          <div v-if="confirmandoEmail" class="confirm-banner">
            <div class="confirm-banner__icon">
              <i class='bx bx-envelope'></i>
            </div>
            <div class="confirm-banner__body">
              <p class="confirm-banner__title">Cambio de correo electronico</p>
              <p class="confirm-banner__text">
                El correo cambiara a <strong>{{ formulario.email }}</strong>.
                Tu sesion se cerrara y deberas iniciar sesion con el nuevo correo.
              </p>
            </div>
          </div>

          <div class="modal-actions">
            <template v-if="confirmandoEmail">
              <button type="button" @click="cancelarConfirmacion" class="btn-secondary" :disabled="cargando">Volver</button>
              <button type="submit" class="btn-primary btn-primary--warning" :class="{ 'btn-primary--loading': cargando }" :disabled="cargando || cargandoSelects">
                <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
                <i v-else class='bx bx-check'></i>
                {{ cargando ? 'Guardando...' : 'Confirmar cambio' }}
              </button>
            </template>
            <template v-else>
              <button type="button" @click="cerrarEditar" class="btn-secondary" :disabled="cargando">Cancelar</button>
              <button type="submit" class="btn-primary" :class="{ 'btn-primary--loading': cargando }" :disabled="cargando || cargandoSelects">
                <i v-if="cargando" class='bx bx-loader-alt bx-spin'></i>
                {{ cargando ? 'Guardando...' : 'Actualizar' }}
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

.btn-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
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

.btn-edit:hover {
  background-color: var(--primary-600);
  box-shadow: 0 3px 8px rgba(42, 199, 143, 0.35);
}

.btn-edit:active {
  transform: scale(0.97);
}

.btn-edit i {
  font-size: 1.1rem;
}

.profile-card {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.profile-card__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
}

.profile-card__avatar {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--radius-full);
  background: var(--primary-500);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  flex-shrink: 0;
}

.profile-card__identity {
  flex: 1;
  min-width: 0;
}

.profile-card__identity h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.profile-card__email {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.profile-card__body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.profile-field__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.profile-field__value {
  font-size: 1rem;
  color: var(--text-primary);
}

.profile-field__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.profile-field__na {
  color: var(--text-secondary);
  font-size: 0.85rem;
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
}

.role-tag { background: #E0E7FF; color: #3730A3; }
.level-tag { background: #DBEAFE; color: #1E40AF; }

/* Modal */
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

@media (max-width: 768px) {
  .profile-card__header {
    flex-wrap: wrap;
  }
  .page-header__title {
    font-size: 1.2rem;
  }
  .modal-overlay {
    padding: 1rem 0.5rem;
    align-items: flex-start;
  }
  .modal-content {
    padding: 1.25rem;
    max-height: none;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useRouter } from 'vue-router'
import ToastNotification from '@/presentation/components/ToastNotification.vue'
import SpecialistFields from '@/presentation/components/SpecialistFields.vue'
import ChipSelect from '@/presentation/components/ChipSelect.vue'
import { usePendingFields } from '@/presentation/composables/usePendingFields'

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
const formularioOriginal = ref({})
const { isPending, markPending, clearPending, hasChanges } = usePendingFields()

const formulario = ref({
  firstName: '', secondName: '',
  firstSurname: '', secondSurname: '',
  documentNumber: '',
  email: '',
  roleIds: [],
  supportLevelIds: [],
  applicationIds: [],
})

const adminRoleId = computed(() => {
  const role = userStore.roles.find(r => r.name.toLowerCase() === 'admin')
  return role?.id ?? null
})

const specialistRoleId = computed(() => {
  const role = userStore.roles.find(r => r.name.toLowerCase() === 'specialist')
  return role?.id ?? null
})

const esSpecialista = computed(() =>
  specialistRoleId.value !== null && formulario.value.roleIds.includes(specialistRoleId.value)
)

const profileSupportLevels = computed(() => {
  return profile.value?.supportLevelNames || []
})

const resolverIds = (nombres, lista) => {
  if (!nombres || !nombres.length) return []
  const nombresLower = nombres.map(n => n.trim().toLowerCase())
  return lista
    .filter(item => nombresLower.includes((item.name || '').toLowerCase()))
    .map(item => item.id)
}

const abrirEditar = async () => {
  const p = profile.value
  cargandoSelects.value = true
  errores.value = {}
  confirmandoEmail.value = false

  try {
    let roleIds = []
    let supportLevelIds = []
    let applicationIds = []

    if (isAdmin.value) {
      await userStore.loadSelects()
      roleIds = resolverIds(p.roleNames, userStore.roles)
      supportLevelIds = resolverIds(p.supportLevelNames, userStore.supportLevels)
      applicationIds = p.applicationAssignments.map(a => a.application_id)
    }

    emailOriginal.value = p.email || ''
    formulario.value = {
      firstName: p.firstName || '',
      secondName: p.secondName || '',
      firstSurname: p.firstSurname || '',
      secondSurname: p.secondSurname || '',
      documentNumber: p.documentNumber || '',
      email: p.email || '',
      roleIds,
      supportLevelIds,
      applicationIds,
    }
    formularioOriginal.value = JSON.parse(JSON.stringify(formulario.value))
    editando.value = true
  } finally {
    cargandoSelects.value = false
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
  if (esSpecialista.value && formulario.value.supportLevelIds.length === 0) {
    errores.value.supportLevels = 'Debe seleccionar al menos un nivel de soporte.'
    valido = false
  }
  return valido
}

const guardar = async () => {
  if (!validarFormulario()) return
  if (!hasChanges(formularioOriginal.value, formulario.value)) {
    cerrarEditar()
    return
  }

  const cambioEmail = emailCambio()

  if (cambioEmail && !confirmandoEmail.value) {
    confirmandoEmail.value = true
    return
  }

  cargando.value = true
  try {
    await userStore.updateUser(null, formulario.value, {
      emailChanged: cambioEmail,
      skipReload: true,
    })

    cerrarEditar()

    if (cambioEmail) {
      authStore.logout()
      router.push('/')
      return
    }

    markPending(formularioOriginal.value, formulario.value)
    await Promise.all([authStore.fetchProfile(), userStore.loadUsers()])
    clearPending()
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
    clearPending()
  }
}

const cancelarConfirmacion = () => {
  confirmandoEmail.value = false
}

const onEsc = (e) => { if (e.key === 'Escape' && editando.value) cerrarEditar() }

onMounted(() => {
  userStore.loadSelects()
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
      <button v-if="profile && !editando" @click="abrirEditar" class="btn-edit" :disabled="cargandoSelects">
        <i :class="cargandoSelects ? 'bx bx-loader-alt bx-spin' : 'bx bx-edit-alt'"></i>
        <span>{{ cargandoSelects ? 'Cargando...' : 'Editar' }}</span>
      </button>
    </div>

    <div class="profile-layout" v-if="profile">
      <!-- Columna izquierda: identidad -->
      <div class="profile-identity">
        <div class="profile-identity__avatar">
          <span>{{ (profile.firstName?.[0] || '').toUpperCase() }}{{ (profile.firstSurname?.[0] || '').toUpperCase() }}</span>
        </div>
        <h2 class="profile-identity__name">{{ profile.fullName }}</h2>
        <span class="profile-identity__email">{{ profile.email || '—' }}</span>
        <span class="status-pill" :class="profile.isActive ? 'status-pill--active' : 'status-pill--inactive'">
          <i class='bx' :class="profile.isActive ? 'bx-check-circle' : 'bx-x-circle'"></i>
          {{ profile.isActive ? 'Activo' : 'Inactivo' }}
        </span>
        <div class="profile-identity__roles" :class="{ 'field--pending': isPending('roleIds') }">
          <template v-if="profile.roleNames.length">
            <span v-for="rol in profile.roleNames" :key="rol" class="role-tag">{{ rol }}</span>
          </template>
          <span v-else class="profile-identity__na">Sin roles</span>
        </div>
      </div>

      <!-- Columna derecha: detalles -->
      <div class="profile-details">
        <!-- Info personal -->
        <div class="detail-card">
          <h3 class="detail-card__title">
            <i class='bx bx-id-card'></i> Informacion Personal
          </h3>
          <div class="detail-card__grid">
            <div class="detail-item" :class="{ 'field--pending': isPending('firstName') }">
              <span class="detail-item__label">Primer nombre</span>
              <span class="detail-item__value">{{ profile.firstName }}</span>
            </div>
            <div class="detail-item" :class="{ 'field--pending': isPending('secondName') }">
              <span class="detail-item__label">Segundo nombre</span>
              <span class="detail-item__value">{{ profile.secondName || '—' }}</span>
            </div>
            <div class="detail-item" :class="{ 'field--pending': isPending('firstSurname') }">
              <span class="detail-item__label">Primer apellido</span>
              <span class="detail-item__value">{{ profile.firstSurname }}</span>
            </div>
            <div class="detail-item" :class="{ 'field--pending': isPending('secondSurname') }">
              <span class="detail-item__label">Segundo apellido</span>
              <span class="detail-item__value">{{ profile.secondSurname || '—' }}</span>
            </div>
            <div class="detail-item" :class="{ 'field--pending': isPending('documentNumber') }">
              <span class="detail-item__label">Documento</span>
              <span class="detail-item__value detail-item__value--mono">{{ profile.documentNumber }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item__label">Correo</span>
              <span class="detail-item__value">{{ profile.email || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Specialist info -->
        <div class="detail-card" v-if="profileSupportLevels.length">
          <h3 class="detail-card__title">
            <i class='bx bx-layer'></i> Niveles de Soporte
          </h3>
          <div class="detail-card__tags">
            <span v-for="level in profileSupportLevels" :key="level" class="level-tag">{{ level }}</span>
          </div>
        </div>

        <!-- Aplicaciones -->
        <div class="detail-card" v-if="profile.applicationAssignments.length">
          <h3 class="detail-card__title">
            <i class='bx bx-grid-alt'></i> Aplicaciones
          </h3>
          <div class="app-list">
            <div v-for="app in profile.applicationAssignments" :key="app.application_id" class="app-item">
              <div class="app-item__icon">
                <i class='bx bx-cube'></i>
              </div>
              <div class="app-item__info">
                <span class="app-item__name">{{ app.application_name }}</span>
                <span v-if="app.assigned_at" class="app-item__date">Desde {{ new Date(app.assigned_at).toLocaleDateString('es-CO') }}</span>
              </div>
            </div>
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
              <input v-model="formulario.firstName" type="text" required class="form-input" :disabled="cargando">
            </div>
            <div class="form-group">
              <label>Segundo Nombre</label>
              <input v-model="formulario.secondName" type="text" class="form-input" :disabled="cargando">
            </div>
            <div class="form-group">
              <label>Primer Apellido *</label>
              <input v-model="formulario.firstSurname" type="text" required class="form-input" :disabled="cargando">
            </div>
            <div class="form-group">
              <label>Segundo Apellido</label>
              <input v-model="formulario.secondSurname" type="text" class="form-input" :disabled="cargando">
            </div>
            <div class="form-group">
              <label>Numero de Documento *</label>
              <input v-model="formulario.documentNumber" type="text" required class="form-input"
                :class="{ 'input-error': errores.documentNumber }" :disabled="cargando">
              <span v-if="errores.documentNumber" class="error-text">{{ errores.documentNumber }}</span>
            </div>
            <div class="form-group">
              <label>Correo electronico</label>
              <input v-model="formulario.email" type="email" class="form-input" placeholder="correo@ejemplo.com"
                :class="{ 'input-error': errores.email }" autocomplete="new-email" :disabled="cargando">
              <span v-if="errores.email" class="error-text">{{ errores.email }}</span>
              <span v-else class="hint-text">Si se cambia, tu sesion se cerrara.</span>
            </div>
            <template v-if="isAdmin">
              <div class="form-group form-group--full">
                <ChipSelect
                  :options="userStore.roles"
                  v-model="formulario.roleIds"
                  label="Roles *"
                  icon="bx-shield"
                  color="amber"
                  :loading="userStore.loadingSelects"
                  :disabled="cargando"
                  :error="errores.roles"
                  :locked-ids="adminRoleId ? [adminRoleId] : []"
                  empty-text="Sin roles disponibles"
                />
              </div>
              <div v-if="esSpecialista" class="form-group form-group--full">
                <SpecialistFields
                  :support-levels="userStore.supportLevels"
                  :applications="userStore.applications"
                  :selected-support-level-ids="formulario.supportLevelIds"
                  :selected-application-ids="formulario.applicationIds"
                  :loading="userStore.loadingSelects"
                  :disabled="cargando"
                  :support-level-error="errores.supportLevels"
                  @update:selected-support-level-ids="formulario.supportLevelIds = $event"
                  @update:selected-application-ids="formulario.applicationIds = $event"
                />
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

.btn-edit:active { transform: scale(0.97); }
.btn-edit i { font-size: 1.1rem; }

/* ---- Profile Layout ---- */
.profile-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  align-items: start;
}

/* ---- Identity card (left) ---- */
.profile-identity {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
}

.profile-identity__avatar {
  width: 5rem;
  height: 5rem;
  border-radius: var(--radius-full, 50%);
  background: linear-gradient(135deg, var(--primary-500), #1a9e6f);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.profile-identity__name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.profile-identity__email {
  font-size: 0.82rem;
  color: var(--text-secondary);
  word-break: break-all;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full, 9999px);
  font-size: 0.75rem;
  font-weight: 600;
}

.status-pill--active {
  background: var(--success-bg);
  color: var(--success-text);
}

.status-pill--inactive {
  background: var(--error-bg);
  color: var(--error-text);
}

.profile-identity__roles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
  margin-top: 0.25rem;
}

.profile-identity__na {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* ---- Detail cards (right) ---- */
.profile-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-card {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.25rem 1.5rem;
}

.detail-card__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-light);
}

.detail-card__title i {
  font-size: 1.1rem;
}

.detail-card__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 2rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.detail-item__label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}

.detail-item__value {
  font-size: 0.95rem;
  color: var(--text-primary);
  font-weight: 500;
}

.detail-item__value--mono {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  letter-spacing: 0.03em;
}

.detail-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

/* App list */
.app-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.app-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md);
  background: var(--bg-card, #f9fafb);
  transition: background 0.15s;
}

.app-item:hover {
  background: #f0f1f3;
}

.app-item__icon {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  background: #EEF2FF;
  color: #4F46E5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.app-item__info {
  display: flex;
  flex-direction: column;
}

.app-item__name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.app-item__date {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

/* Tags */
.role-tag, .level-tag {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-full, 9999px);
  font-size: 0.78rem;
  font-weight: 600;
}

.role-tag { background: #E0E7FF; color: #3730A3; }
.level-tag { background: #DBEAFE; color: #1E40AF; }

/* ---- Modal ---- */
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

.btn-primary--warning { background-color: #F59E0B; }
.btn-primary--warning:hover:not(:disabled) { background-color: #D97706; }

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

.hint-text {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
  display: block;
}

/* Pending animation */
.field--pending {
  animation: pendingPulse 1.5s ease-in-out infinite;
}

@keyframes pendingPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Responsive */
@media (max-width: 768px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
  .profile-identity {
    flex-direction: row;
    flex-wrap: wrap;
    text-align: left;
    padding: 1.25rem;
    gap: 0.5rem 1rem;
  }
  .profile-identity__avatar {
    width: 3.5rem;
    height: 3.5rem;
    font-size: 1.2rem;
  }
  .profile-identity__name {
    flex: 1;
    min-width: 120px;
  }
  .profile-identity__email {
    width: 100%;
  }
  .profile-identity__roles {
    justify-content: flex-start;
  }
  .detail-card__grid {
    grid-template-columns: 1fr;
  }
  .page-header__title { font-size: 1.2rem; }
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

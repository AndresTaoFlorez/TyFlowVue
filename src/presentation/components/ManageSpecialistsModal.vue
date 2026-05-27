<script setup>
import { ref, onMounted } from 'vue'
import { fetchApplicationSpecialistsUseCase } from '@/application/use-cases/applications/FetchApplicationSpecialistsUseCase'
import { updateUserUseCase } from '@/application/use-cases/users/UpdateUserUseCase'
import { fetchUsersUseCase } from '@/application/use-cases/users/FetchUsersUseCase'

const props = defineProps({
  visible: { type: Boolean, default: false },
  appId: { type: String, required: true },
  specialists: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'assign', 'remove'])

const allUsers = ref([])
const searchTerm = ref('')
const loadingUsers = ref(false)
const processing = ref(null)

onMounted(async () => {
  loadingUsers.value = true
  try {
    const users = await fetchUsersUseCase()
    allUsers.value = users.filter((u) => u.specialistId)
  } catch {
    // silent
  } finally {
    loadingUsers.value = false
  }
})

const availableUsers = () => {
  const assignedIds = new Set(props.specialists.map((s) => s.id))
  let filtered = allUsers.value.filter((u) => !assignedIds.has(u.id))
  const term = searchTerm.value.toLowerCase().trim()
  if (term) {
    filtered = filtered.filter((u) =>
      u.fullName.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
    )
  }
  return filtered
}

async function assignUser(user) {
  processing.value = user.id
  try {
    const currentAppIds = (user.applicationAssignments || []).map((a) => a.id || a)
    await updateUserUseCase(user.id, {
      application_ids: [...currentAppIds, props.appId],
    })
    emit('assign', user)
  } catch {
    // silent
  } finally {
    processing.value = null
  }
}

async function removeUser(user) {
  processing.value = user.id
  try {
    const currentAppIds = (user.applicationAssignments || []).map((a) => a.id || a)
    await updateUserUseCase(user.id, {
      application_ids: currentAppIds.filter((id) => id !== props.appId),
    })
    emit('remove', user.id)
  } catch {
    // silent
  } finally {
    processing.value = null
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Gestionar Especialistas</h2>
        <button @click="emit('close')" class="btn-close"><i class='bx bx-x'></i></button>
      </div>

      <!-- Assigned -->
      <div class="section">
        <h3 class="section__title">Asignados ({{ specialists.length }})</h3>
        <div v-if="specialists.length === 0" class="section__empty">Sin especialistas asignados.</div>
        <div v-for="user in specialists" :key="user.id" class="user-row">
          <div class="user-row__info">
            <span class="user-row__name">{{ user.fullName }}</span>
            <span class="user-row__email">{{ user.email }}</span>
          </div>
          <button
            class="btn-remove"
            :disabled="processing === user.id"
            @click="removeUser(user)"
          >
            <i class='bx bx-x'></i>
          </button>
        </div>
      </div>

      <!-- Available -->
      <div class="section">
        <h3 class="section__title">Disponibles</h3>
        <div class="search-box">
          <i class='bx bx-search'></i>
          <input v-model="searchTerm" type="text" placeholder="Buscar especialista...">
        </div>
        <div v-if="loadingUsers" class="section__empty"><i class='bx bx-loader-alt bx-spin'></i> Cargando...</div>
        <div v-else-if="availableUsers().length === 0" class="section__empty">Sin especialistas disponibles.</div>
        <div v-for="user in availableUsers()" :key="user.id" class="user-row">
          <div class="user-row__info">
            <span class="user-row__name">{{ user.fullName }}</span>
            <span class="user-row__email">{{ user.email }}</span>
          </div>
          <button
            class="btn-add"
            :disabled="processing === user.id"
            @click="assignUser(user)"
          >
            <i class='bx bx-plus'></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-lg);
  max-width: 480px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modal-header h2 { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); }

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.section { margin-bottom: 1rem; }
.section__title { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem; }
.section__empty { font-size: 0.85rem; color: var(--text-secondary); padding: 0.5rem 0; }

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border-light);
}

.user-row:last-child { border-bottom: none; }

.user-row__info { display: flex; flex-direction: column; }
.user-row__name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); }
.user-row__email { font-size: 0.75rem; color: var(--text-secondary); }

.btn-remove, .btn-add {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.15s;
}

.btn-remove { background: var(--error-bg); color: var(--error-500); }
.btn-remove:hover { background: var(--error-500); color: white; }

.btn-add { background: var(--success-bg); color: var(--success-text); }
.btn-add:hover { background: var(--primary-500); color: white; }

.btn-remove:disabled, .btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

.search-box {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
}

.search-box i { color: var(--text-secondary); font-size: 1rem; }

.search-box input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.85rem;
  color: var(--text-primary);
  background: transparent;
}
</style>

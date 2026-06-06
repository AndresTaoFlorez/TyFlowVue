<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { UserRepository } from '@/infrastructure/repositories/UserRepository'

const props = defineProps({
  caseData: { type: Object, required: true },
})

const emit = defineEmits(['close', 'done'])

const store = useCasesStore()
const userStore = useUserStore()

const form = ref({
  newSpecialistId: '',
  reason: '',
  note: '',
  newSupportLevelId: '',
})

const submitting = ref(false)
const error = ref(null)
const loadingSpecialists = ref(false)
const appUsers = ref([])

// Load workloads + users for the case's application on open
onMounted(async () => {
  const appId = props.caseData.applicationId
  if (!appId) return
  loadingSpecialists.value = true
  try {
    const [users] = await Promise.all([
      UserRepository.fetchByApplication(appId),
      store.loadWorkloads(appId),
    ])
    appUsers.value = users
  } catch { /* silent */ }
  finally { loadingSpecialists.value = false }
})

// Specialists for this app, excluding the currently assigned one
// Enriched with workload data for case count display
const specialists = computed(() => {
  const excluded = props.caseData.specialistId
  return appUsers.value
    .filter(u => u.specialistId && u.specialistId !== excluded)
    .map(u => {
      const w = store.specialistWorkloads.find(wl => wl.specialist_id === u.specialistId)
      return {
        specialist_id: u.specialistId,
        full_name: u.fullName,
        current_count: w?.current_count ?? null,
        is_available: w?.is_available ?? false,
      }
    })
    .sort((a, b) => (a.current_count ?? 999) - (b.current_count ?? 999))
})

const supportLevels = computed(() => userStore.supportLevels ?? [])

const currentSpecialist = computed(() => {
  const u = appUsers.value.find(u => u.specialistId === props.caseData.specialistId)
  if (u) return u.fullName
  const w = store.specialistWorkloads.find(s => s.specialist_id === props.caseData.specialistId)
  return w?.full_name ?? props.caseData.specialistId?.slice(0, 8) ?? '—'
})

async function handleReassign() {
  if (!form.value.newSpecialistId || !form.value.reason.trim()) return
  submitting.value = true
  error.value = null

  try {
    await store.reassign({
      caseId: props.caseData.id,
      currentSpecialistId: props.caseData.specialistId,
      newSpecialistId: form.value.newSpecialistId,
      reason: form.value.reason.trim(),
      note: form.value.note.trim() || null,
      newSupportLevelId: form.value.newSupportLevelId || null,
    })
    emit('done')
  } catch (e) {
    error.value = store.actionError || e.message || 'Error reasignando caso'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="rm__overlay" @click.self="emit('close')">
    <div class="rm">
      <div class="rm__header">
        <h4 class="rm__title">Reasignar caso {{ caseData.shortId }}</h4>
        <button class="rm__close" @click="emit('close')"><i class="bx bx-x"></i></button>
      </div>

      <div class="rm__body">
        <div class="rm__field">
          <label class="rm__label">Especialista actual</label>
          <div class="rm__readonly">{{ currentSpecialist }}</div>
        </div>

        <div class="rm__field">
          <label class="rm__label">Nuevo especialista *</label>
          <select v-model="form.newSpecialistId" class="rm__select" :disabled="loadingSpecialists">
            <option value="">{{ loadingSpecialists ? 'Cargando...' : specialists.length ? '— Seleccionar —' : '— Sin especialistas disponibles —' }}</option>
            <option v-for="s in specialists" :key="s.specialist_id" :value="s.specialist_id">
              {{ s.full_name }}{{ s.current_count !== null ? ` (${s.current_count} caso${s.current_count !== 1 ? 's' : ''})` : '' }}{{ !s.is_available ? ' · sin turno' : '' }}
            </option>
          </select>
        </div>

        <div class="rm__field">
          <label class="rm__label">Razón *</label>
          <input v-model="form.reason" type="text" class="rm__input" placeholder="Motivo de reasignación" />
        </div>

        <div class="rm__field">
          <label class="rm__label">Nota</label>
          <textarea v-model="form.note" class="rm__textarea" placeholder="Nota adicional (opcional)" rows="2"></textarea>
        </div>

        <div class="rm__field">
          <label class="rm__label">Nuevo nivel de soporte</label>
          <select v-model="form.newSupportLevelId" class="rm__select">
            <option value="">— Sin cambio —</option>
            <option v-for="lv in supportLevels" :key="lv.id" :value="lv.id">{{ lv.name }}</option>
          </select>
        </div>

        <div v-if="error" class="rm__error">
          <i class="bx bx-error-circle"></i> {{ error }}
        </div>
      </div>

      <div class="rm__footer">
        <button class="rm__btn rm__btn--cancel" @click="emit('close')">Cancelar</button>
        <button
          class="rm__btn rm__btn--submit"
          :disabled="submitting || !form.newSpecialistId || !form.reason.trim()"
          @click="handleReassign"
        >
          <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
          {{ submitting ? 'Reasignando...' : 'Reasignar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rm__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.rm {
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
}

.rm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
}

.rm__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.rm__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.1rem;
}

.rm__close:hover { background: var(--bg-card); }

.rm__body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rm__field { display: flex; flex-direction: column; gap: 0.25rem; }

.rm__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.rm__readonly {
  padding: 0.45rem 0.6rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: var(--text-primary);
}

.rm__select, .rm__input, .rm__textarea {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
}

.rm__select:focus, .rm__input:focus, .rm__textarea:focus {
  border-color: var(--primary-500);
}

.rm__textarea { resize: vertical; }

.rm__error {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.5rem 0.7rem;
  background: var(--error-bg);
  color: var(--error-text);
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  font-weight: 600;
}

.rm__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--border-light);
}

.rm__btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.12s;
}

.rm__btn--cancel {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.rm__btn--cancel:hover { color: var(--text-primary); }

.rm__btn--submit {
  background: var(--primary-500);
  color: white;
}

.rm__btn--submit:hover:not(:disabled) { background: var(--primary-600); }
.rm__btn--submit:disabled { opacity: 0.55; cursor: not-allowed; }
</style>

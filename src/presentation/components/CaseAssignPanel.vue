<script setup>
import { ref, computed, watch } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { ApplicationRepository } from '@/infrastructure/repositories/ApplicationRepository'
import { SupportLevelRepository } from '@/infrastructure/repositories/SupportLevelRepository'

const props = defineProps({
  caseId: { type: String, required: true },
})

const emit = defineEmits(['done'])

const store = useCasesStore()
const userStore = useUserStore()

const mode = ref('wdd')
const form = ref({
  applicationId: '',
  supportLevelId: '',
  supportCategoryId: '',
  specialistId: '',
  workWindowId: '',
  reason: '',
})

const submitting = ref(false)
const error = ref(null)

// Cascading data
const availableLevels = ref([])
const availableCategories = ref([])
const loadingLevels = ref(false)
const loadingCategories = ref(false)

const applications = computed(() => userStore.applications ?? [])
const specialists = computed(() => store.specialistWorkloads)

// App changed → load levels, clear downstream
watch(() => form.value.applicationId, async (appId) => {
  form.value.supportLevelId = ''
  form.value.supportCategoryId = ''
  availableLevels.value = []
  availableCategories.value = []
  if (!appId) return
  loadingLevels.value = true
  try {
    const pivots = await ApplicationRepository.fetchSupportLevels(appId)
    const ids = pivots.map(p => p.support_level_id)
    availableLevels.value = (userStore.supportLevels ?? []).filter(l => ids.includes(l.id))
  } catch { /* silent */ }
  finally { loadingLevels.value = false }
})

// Level changed → load categories, clear downstream
watch(() => form.value.supportLevelId, async (levelId) => {
  form.value.supportCategoryId = ''
  availableCategories.value = []
  if (!levelId) return
  loadingCategories.value = true
  try {
    const pivots = await SupportLevelRepository.fetchSupportCategories(levelId)
    const ids = pivots.map(p => p.support_category_id)
    availableCategories.value = (userStore.supportCategories ?? []).filter(c => ids.includes(c.id))
  } catch { /* silent */ }
  finally { loadingCategories.value = false }
})

async function handleAssign() {
  submitting.value = true
  error.value = null

  try {
    if (mode.value === 'wdd') {
      await store.assignWdd({
        caseId: props.caseId,
        applicationId: form.value.applicationId,
        supportLevelId: form.value.supportLevelId || null,
        supportCategoryId: form.value.supportCategoryId || null,
      })
    } else {
      await store.assignManual({
        caseId: props.caseId,
        specialistId: form.value.specialistId,
        workWindowId: form.value.workWindowId || null,
        reason: form.value.reason.trim() || null,
      })
    }
    emit('done')
  } catch (e) {
    error.value = store.error || e.message || 'Error asignando caso'
  } finally {
    submitting.value = false
  }
}

const canSubmit = computed(() => {
  if (submitting.value) return false
  if (mode.value === 'wdd') return !!form.value.applicationId
  return !!form.value.specialistId
})
</script>

<template>
  <div class="ap">
    <h4 class="ap__title">Asignar caso</h4>

    <!-- Mode tabs -->
    <div class="ap__modes">
      <button class="ap__mode" :class="{ 'ap__mode--on': mode === 'wdd' }" @click="mode = 'wdd'">
        <i class="bx bx-bot"></i> WDD Auto
      </button>
      <button class="ap__mode" :class="{ 'ap__mode--on': mode === 'manual' }" @click="mode = 'manual'">
        <i class="bx bx-user"></i> Manual
      </button>
    </div>

    <!-- WDD form -->
    <template v-if="mode === 'wdd'">
      <div class="ap__field">
        <label class="ap__label">Aplicación *</label>
        <select v-model="form.applicationId" class="ap__select">
          <option value="">— Seleccionar —</option>
          <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
        </select>
      </div>

      <div class="ap__field">
        <label class="ap__label">Nivel de soporte</label>
        <select v-model="form.supportLevelId" class="ap__select" :disabled="!form.applicationId || loadingLevels">
          <option value="">{{ loadingLevels ? 'Cargando...' : availableLevels.length ? '— Ninguno —' : '— Seleccione app —' }}</option>
          <option v-for="lv in availableLevels" :key="lv.id" :value="lv.id">{{ lv.name }}</option>
        </select>
      </div>

      <div class="ap__field">
        <label class="ap__label">Categoría</label>
        <select v-model="form.supportCategoryId" class="ap__select" :disabled="!form.supportLevelId || loadingCategories">
          <option value="">{{ loadingCategories ? 'Cargando...' : availableCategories.length ? '— Ninguna —' : '— Seleccione nivel —' }}</option>
          <option v-for="cat in availableCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
      </div>
    </template>

    <!-- Manual form -->
    <template v-else>
      <div class="ap__field">
        <label class="ap__label">Especialista *</label>
        <select v-model="form.specialistId" class="ap__select">
          <option value="">— Seleccionar —</option>
          <option v-for="s in specialists" :key="s.specialist_id" :value="s.specialist_id">
            {{ s.full_name }} ({{ s.current_count ?? 0 }} casos)
          </option>
        </select>
      </div>

      <div class="ap__field">
        <label class="ap__label">Razón</label>
        <input v-model="form.reason" type="text" class="ap__input" placeholder="Motivo de asignación (opcional)" />
      </div>
    </template>

    <div v-if="error" class="ap__error">
      <i class="bx bx-error-circle"></i> {{ error }}
    </div>

    <button class="ap__submit" :disabled="!canSubmit" @click="handleAssign">
      <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
      <i v-else class="bx bx-check"></i>
      {{ submitting ? 'Asignando...' : 'Asignar' }}
    </button>
  </div>
</template>

<style scoped>
.ap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.ap__title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
}

.ap__modes {
  display: flex;
  gap: 0.35rem;
}

.ap__mode {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.45rem;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border-light);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition: all 0.12s;
}

.ap__mode--on {
  border-color: var(--primary-500);
  color: var(--primary-600);
  background: rgba(42, 199, 143, 0.06);
}

.ap__field { display: flex; flex-direction: column; gap: 0.25rem; }

.ap__label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.ap__select, .ap__input {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
}

.ap__select:focus, .ap__input:focus { border-color: var(--primary-500); }
.ap__select:disabled { opacity: 0.5; cursor: not-allowed; }

.ap__error {
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

.ap__submit {
  padding: 0.55rem;
  background: var(--primary-500);
  color: white;
  font-weight: 700;
  font-size: 0.82rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: background 0.12s;
}

.ap__submit:hover:not(:disabled) { background: var(--primary-600); }
.ap__submit:disabled { opacity: 0.55; cursor: not-allowed; }
</style>

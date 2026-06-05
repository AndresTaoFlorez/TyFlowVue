<script setup>
import { ref, computed, watch } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCascadingSelects } from '@/presentation/composables/useCascadingSelects'

const props = defineProps({
  caseId: { type: String, required: true },
  mode: { type: String, required: true }, // 'wdd' | 'manual'
})

const emit = defineEmits(['done'])

const store = useCasesStore()
const userStore = useUserStore()

const _case = store.selectedCase

const form = ref({
  applicationId: _case?.applicationId ?? '',
  supportLevelId: _case?.supportLevelId ?? '',
  supportCategoryId: _case?.supportCategoryId ?? '',
  specialistId: '',
  reason: '',
})

const submitting = ref(false)
const error = ref(null)

const applications = computed(() => userStore.applications ?? [])
const panelWorkloads = ref([])

// Track initial values so cascading watchers don't clear them on first run
let _pendingLevelId = _case?.supportLevelId ?? null
let _pendingCategoryId = _case?.supportCategoryId ?? null

// Cascading selects
const { availableLevels, availableCategories, loadingLevels, loadingCategories } =
  useCascadingSelects(
    computed(() => form.value.applicationId),
    computed({
      get: () => form.value.supportLevelId,
      set: v => {
        // On first cascade (app watcher clears level), restore the case's level
        if (v === '' && _pendingLevelId) {
          form.value.supportLevelId = _pendingLevelId
          _pendingLevelId = null
        } else {
          form.value.supportLevelId = v
        }
      },
    }),
    computed({
      get: () => form.value.supportCategoryId,
      set: v => {
        if (v === '' && _pendingCategoryId) {
          form.value.supportCategoryId = _pendingCategoryId
          _pendingCategoryId = null
        } else {
          form.value.supportCategoryId = v
        }
      },
    }),
    { immediate: true },
  )

// App changed → load workloads
watch(() => form.value.applicationId, (appId) => {
  panelWorkloads.value = []
  if (appId) {
    store.loadWorkloads(appId).then(() => {
      panelWorkloads.value = [...store.specialistWorkloads]
    })
  }
}, { immediate: true })

// Info computed
const selectedAppName = computed(() => {
  const app = applications.value.find(a => a.id === form.value.applicationId)
  return app?.name ?? null
})

const specialistCount = computed(() => panelWorkloads.value.length)

async function handleAssign() {
  submitting.value = true
  error.value = null

  try {
    if (props.mode === 'wdd') {
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
        reason: form.value.reason.trim() || null,
      })
    }
    emit('done')
  } catch (e) {
    error.value = store.actionError || e.message || 'Error asignando caso'
  } finally {
    submitting.value = false
  }
}

const canSubmit = computed(() => {
  if (submitting.value) return false
  if (props.mode === 'wdd') return !!form.value.applicationId
  return !!form.value.specialistId
})
</script>

<template>
  <div class="ap">
    <!-- Info badges -->
    <div v-if="form.applicationId && !loadingLevels" class="ap__info">
      <span class="ap__info-chip">
        <i class="bx bx-user"></i> {{ specialistCount }} especialista{{ specialistCount !== 1 ? 's' : '' }}
      </span>
      <span class="ap__info-chip">
        <i class="bx bx-layer"></i> {{ availableLevels.length }} nivel{{ availableLevels.length !== 1 ? 'es' : '' }}
      </span>
      <span class="ap__info-chip">
        <i class="bx bx-category"></i> {{ availableCategories.length }} categoría{{ availableCategories.length !== 1 ? 's' : '' }}
      </span>
    </div>
    <div v-else-if="loadingLevels" class="ap__info">
      <span class="ap__info-chip"><i class="bx bx-loader-alt bx-spin"></i> Cargando...</span>
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
          <option v-for="s in panelWorkloads" :key="s.specialist_id" :value="s.specialist_id">
            {{ s.full_name }} ({{ s.current_count ?? 0 }} casos)
          </option>
        </select>
      </div>

      <div class="ap__field">
        <label class="ap__label">Razón</label>
        <input v-model="form.reason" type="text" class="ap__input" placeholder="Motivo (opcional)" />
      </div>
    </template>

    <div v-if="error" class="ap__error">
      <i class="bx bx-error-circle"></i> {{ error }}
    </div>

    <button class="ap__submit" :disabled="!canSubmit" @click="handleAssign">
      <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
      <i v-else class="bx bx-check"></i>
      {{ submitting ? 'Asignando...' : 'Confirmar asignación' }}
    </button>
  </div>
</template>

<style scoped>
.ap {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.ap__info {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.ap__info-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.5rem;
  background: rgba(42, 199, 143, 0.08);
  border: 1px solid rgba(42, 199, 143, 0.2);
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--primary-600);
}

.ap__field { display: flex; flex-direction: column; gap: 0.2rem; }

.ap__label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.ap__select, .ap__input {
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.78rem;
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
  padding: 0.45rem 0.6rem;
  background: var(--error-bg);
  color: var(--error-text);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
}

.ap__submit {
  padding: 0.5rem;
  background: var(--primary-500);
  color: white;
  font-weight: 700;
  font-size: 0.78rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  transition: background 0.12s;
}

.ap__submit:hover:not(:disabled) { background: var(--primary-600); }
.ap__submit:disabled { opacity: 0.55; cursor: not-allowed; }
</style>

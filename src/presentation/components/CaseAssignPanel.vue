<script setup>
import { ref, computed, watch } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCascadingSelects } from '@/presentation/composables/useCascadingSelects'
import { UserRepository } from '@/infrastructure/repositories/UserRepository'

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
  supportLevelId: '',
  supportCategoryId: '',
  specialistId: '',
  reason: '',
})

const submitting = ref(false)
const error = ref(null)

const applications = computed(() => userStore.applications ?? [])

// Keep case's original values to restore once options load
const _pendingLevel = _case?.supportLevelId ?? null
const _pendingCategory = _case?.supportCategoryId ?? null

// Cascading selects: App → SupportLevels → Categories (drives the form dropdowns)
const { availableLevels, availableCategories, loadingLevels, loadingCategories } =
  useCascadingSelects(
    computed(() => form.value.applicationId),
    computed({
      get: () => form.value.supportLevelId,
      set: v => { form.value.supportLevelId = v },
    }),
    computed({
      get: () => form.value.supportCategoryId,
      set: v => { form.value.supportCategoryId = v },
    }),
    { immediate: true },
  )

// Once levels load, restore the case's pre-existing level (if it's in the list)
watch(availableLevels, (levels) => {
  if (_pendingLevel && !form.value.supportLevelId && levels.some(l => l.id === _pendingLevel)) {
    form.value.supportLevelId = _pendingLevel
  }
})

// Once categories load, restore the case's pre-existing category (if it's in the list)
watch(availableCategories, (cats) => {
  if (_pendingCategory && !form.value.supportCategoryId && cats.some(c => c.id === _pendingCategory)) {
    form.value.supportCategoryId = _pendingCategory
  }
})

// ── Specialist loading & filtering ──

// All specialists who have any assignment in the selected app
const appUsers = ref([])
const loadingUsers = ref(false)

// When app changes: reload specialists and workloads for that app
watch(
  () => form.value.applicationId,
  async (appId) => {
    appUsers.value = []
    form.value.specialistId = ''
    if (!appId) return
    loadingUsers.value = true
    try {
      const [users] = await Promise.all([
        UserRepository.fetchByApplication(appId),
        store.loadWorkloads(appId),
      ])
      appUsers.value = users
    } catch { /* silent */ }
    finally { loadingUsers.value = false }
  },
  { immediate: true }
)

// Specialists filtered to those who handle the selected (app, level) combination.
// Recomputes automatically when supportLevelId changes (reactive).
const eligibleUsers = computed(() => {
  const appId = form.value.applicationId
  const levelId = form.value.supportLevelId
  if (!levelId) return appUsers.value
  return appUsers.value.filter(u =>
    u.applicationAssignments.some(a =>
      a.application_id === appId && a.support_level_id === levelId
    )
  )
})

const eligibleIds = computed(() =>
  new Set(eligibleUsers.value.map(u => u.specialistId).filter(Boolean))
)

// Workloads cross-referenced with eligible specialists (for availability info)
const eligibleWorkloads = computed(() =>
  store.specialistWorkloads.filter(w => eligibleIds.value.has(w.specialist_id))
)

// For the manual dropdown: eligible users enriched with workload data, sorted by load
const specialistsForDropdown = computed(() =>
  eligibleUsers.value
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
)

const isLoading = computed(() => loadingLevels.value || loadingUsers.value)
const eligibleCount  = computed(() => eligibleUsers.value.length)
const availableCount = computed(() => eligibleWorkloads.value.filter(w => w.is_available).length)

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

    <!-- Info badges: show ONLY specialists matching the current (app, level) selection -->
    <div v-if="form.applicationId && !isLoading" class="ap__info">
      <span class="ap__info-chip">
        <i class="bx bx-user-check"></i>
        {{ eligibleCount }} especialista{{ eligibleCount !== 1 ? 's' : '' }} elegible{{ eligibleCount !== 1 ? 's' : '' }}
      </span>
      <span v-if="form.supportLevelId" class="ap__info-chip ap__info-chip--avail">
        <i class="bx bx-wifi"></i>
        {{ availableCount }} con turno activo
      </span>
    </div>
    <div v-else-if="isLoading" class="ap__info">
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

      <!-- WDD notice when no eligible specialists -->
      <p v-if="!isLoading && form.supportLevelId && eligibleCount === 0" class="ap__warn">
        <i class="bx bx-error-circle"></i>
        Sin especialistas para este nivel en la aplicación.
      </p>
    </template>

    <!-- Manual form -->
    <template v-else>
      <div class="ap__field">
        <label class="ap__label">Nivel de soporte <span class="ap__label-hint">(para filtrar especialistas)</span></label>
        <select v-model="form.supportLevelId" class="ap__select" :disabled="!form.applicationId || loadingLevels">
          <option value="">{{ loadingLevels ? 'Cargando...' : '— Todos los niveles —' }}</option>
          <option v-for="lv in availableLevels" :key="lv.id" :value="lv.id">{{ lv.name }}</option>
        </select>
      </div>

      <div class="ap__field">
        <label class="ap__label">Especialista *</label>
        <select v-model="form.specialistId" class="ap__select" :disabled="isLoading || eligibleCount === 0">
          <option value="">
            {{ isLoading ? 'Cargando...' : eligibleCount === 0 ? '— Sin especialistas elegibles —' : '— Seleccionar —' }}
          </option>
          <option v-for="s in specialistsForDropdown" :key="s.specialist_id" :value="s.specialist_id">
            {{ s.full_name }}{{ s.current_count !== null ? ` (${s.current_count} caso${s.current_count !== 1 ? 's' : ''})` : '' }}{{ !s.is_available ? ' · sin turno' : '' }}
          </option>
        </select>
        <span v-if="!isLoading && eligibleCount === 0 && form.applicationId" class="ap__hint">
          {{ form.supportLevelId ? 'Ningún especialista asignado a este nivel.' : 'Selecciona un nivel para filtrar, o se mostrarán todos.' }}
        </span>
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

.ap__info-chip--avail {
  background: rgba(42, 199, 143, 0.15);
  border-color: rgba(42, 199, 143, 0.35);
}

.ap__field { display: flex; flex-direction: column; gap: 0.2rem; }

.ap__label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.ap__label-hint {
  font-size: 0.62rem;
  font-weight: 400;
  opacity: 0.7;
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

.ap__hint {
  font-size: 0.67rem;
  color: var(--text-secondary);
  font-style: italic;
}

.ap__warn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  color: var(--warning-text, #b45309);
  background: var(--warning-bg, #fef3c7);
  border-radius: var(--radius-md);
  padding: 0.35rem 0.55rem;
}

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

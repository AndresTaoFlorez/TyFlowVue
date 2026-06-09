<script setup>
import { ref, computed, watch } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { CaseAssignContextRepository } from '@/infrastructure/repositories/CaseAssignContextRepository'

// Module-level context cache — keyed by caseId (phase-1 only; phase-2 is keyed by caseId+levelId)
const _ctxCache = new Map() // `${caseId}` or `${caseId}_${levelId}` → context

const props = defineProps({
  caseId: { type: String, required: true },
})

const emit = defineEmits(['done'])

const store = useCasesStore()
const _case = store.selectedCase

const form = ref({
  supportLevelId:    _case?.supportLevelId ?? '',
  supportCategoryId: '', // restored after phase-2 loads categories
  specialistId:      '',
  reason:            '',
})

const submitting  = ref(null)  // null | 'wdd' | 'manual'
const error       = ref(null)
const activeMode  = ref('wdd') // 'wdd' | 'manual'

// Context state
const availableLevels     = ref([])
const availableCategories = ref([])
const specialists         = ref([])
const loadingCtx          = ref(false)

// ── Phase 1: load on mount ──
async function loadPhase1() {
  const cacheKey = props.caseId
  if (_ctxCache.has(cacheKey)) {
    const cached = _ctxCache.get(cacheKey)
    availableLevels.value = cached.supportLevels
    specialists.value     = cached.specialists
    _restorePendingLevel()
    return
  }

  loadingCtx.value = true
  try {
    const ctx = await CaseAssignContextRepository.fetchContext(props.caseId)
    _ctxCache.set(cacheKey, ctx)
    availableLevels.value = ctx.supportLevels
    specialists.value     = ctx.specialists
    _restorePendingLevel()
  } catch { /* silent */ }
  finally { loadingCtx.value = false }
}

// ── Phase 2: reload when level changes (immediate fires for pre-filled level on mount) ──
watch(() => form.value.supportLevelId, async (levelId) => {
  form.value.supportCategoryId = ''
  availableCategories.value    = []

  if (!levelId) {
    // revert to phase-1 full specialist list
    const cached = _ctxCache.get(props.caseId)
    if (cached) specialists.value = cached.specialists
    return
  }

  const cacheKey = `${props.caseId}_${levelId}`
  if (_ctxCache.has(cacheKey)) {
    const cached = _ctxCache.get(cacheKey)
    availableCategories.value = cached.supportCategories
    specialists.value         = cached.specialists
    _restorePendingCategory()
    return
  }

  loadingCtx.value = true
  try {
    const ctx = await CaseAssignContextRepository.fetchContext(props.caseId, levelId)
    _ctxCache.set(cacheKey, ctx)
    availableCategories.value = ctx.supportCategories
    specialists.value         = ctx.specialists
    _restorePendingCategory()
  } catch { /* silent */ }
  finally { loadingCtx.value = false }
}, { immediate: true })

// Restore pre-existing case values once options arrive
const _pendingLevel    = _case?.supportLevelId    ?? null
const _pendingCategory = _case?.supportCategoryId ?? null

function _restorePendingLevel() {
  if (_pendingLevel && !form.value.supportLevelId &&
      availableLevels.value.some(l => l.id === _pendingLevel)) {
    form.value.supportLevelId = _pendingLevel
  }
}

function _restorePendingCategory() {
  if (_pendingCategory && !form.value.supportCategoryId &&
      availableCategories.value.some(c => c.id === _pendingCategory)) {
    form.value.supportCategoryId = _pendingCategory
  }
}

// Start phase 1
loadPhase1()

// ── Specialist display ──
const specialistsForDropdown = computed(() =>
  [...specialists.value].sort((a, b) => (a.current_count ?? 999) - (b.current_count ?? 999))
)

const eligibleCount  = computed(() => specialists.value.length)
const availableCount = computed(() => specialists.value.filter(s => s.is_available).length)
const isLoading      = computed(() => loadingCtx.value)

// ── Actions ──
async function handleWdd() {
  submitting.value = 'wdd'
  error.value = null
  try {
    await store.assignWdd({
      caseId:           props.caseId,
      applicationId:    _case?.applicationId ?? null,
      supportLevelId:   form.value.supportLevelId    || null,
      supportCategoryId: form.value.supportCategoryId || null,
    })
    emit('done')
  } catch (e) {
    error.value = store.actionError || e.message || 'Error asignando caso'
  } finally {
    submitting.value = null
  }
}

async function handleManual() {
  submitting.value = 'manual'
  error.value = null
  try {
    await store.assignManual({
      caseId:      props.caseId,
      specialistId: form.value.specialistId,
      reason:      form.value.reason.trim() || null,
    })
    emit('done')
  } catch (e) {
    error.value = store.actionError || e.message || 'Error asignando caso'
  } finally {
    submitting.value = null
  }
}

const canSubmitWdd    = computed(() => !submitting.value)
const canSubmitManual = computed(() => !submitting.value && !!form.value.specialistId)
</script>

<template>
  <div class="ap">

    <!-- Level / Category -->
    <div class="ap__field">
      <label class="ap__label">Nivel de soporte</label>
      <select v-model="form.supportLevelId" class="ap__select" :disabled="isLoading">
        <option value="">{{ isLoading ? 'Cargando...' : availableLevels.length ? '— Ninguno —' : '— Sin niveles —' }}</option>
        <option v-for="lv in availableLevels" :key="lv.id" :value="lv.id">{{ lv.name }}</option>
      </select>
    </div>

    <div class="ap__field">
      <label class="ap__label">Categoría</label>
      <select v-model="form.supportCategoryId" class="ap__select" :disabled="!form.supportLevelId || isLoading">
        <option value="">{{ isLoading ? 'Cargando...' : availableCategories.length ? '— Ninguna —' : '— Seleccione nivel —' }}</option>
        <option v-for="cat in availableCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
      </select>
    </div>

    <!-- Specialist info chips -->
    <div v-if="!isLoading" class="ap__info">
      <span class="ap__info-chip">
        <i class="bx bx-user-check"></i>
        {{ eligibleCount }} especialista{{ eligibleCount !== 1 ? 's' : '' }} elegible{{ eligibleCount !== 1 ? 's' : '' }}
      </span>
      <span v-if="form.supportLevelId" class="ap__info-chip ap__info-chip--avail">
        <i class="bx bx-wifi"></i>
        {{ availableCount }} con turno activo
      </span>
    </div>
    <div v-else class="ap__info">
      <span class="ap__info-chip"><i class="bx bx-loader-alt bx-spin"></i> Cargando...</span>
    </div>

    <!-- Mode tabs -->
    <div class="ap__tabs">
      <button
        class="ap__tab"
        :class="{ 'ap__tab--active': activeMode === 'wdd' }"
        :disabled="!!submitting"
        @click="activeMode = 'wdd'"
      >
        <i class="bx bx-bot"></i> WDD Auto
      </button>
      <button
        class="ap__tab"
        :class="{ 'ap__tab--active': activeMode === 'manual' }"
        :disabled="!!submitting"
        @click="activeMode = 'manual'"
      >
        <i class="bx bx-user-plus"></i> Manual
      </button>
    </div>

    <!-- WDD mode -->
    <template v-if="activeMode === 'wdd'">
      <button class="ap__btn ap__btn--wdd" :disabled="!canSubmitWdd" @click="handleWdd">
        <i v-if="submitting === 'wdd'" class="bx bx-loader-alt bx-spin"></i>
        <i v-else class="bx bx-check"></i>
        {{ submitting === 'wdd' ? 'Asignando...' : 'Confirmar WDD Auto' }}
      </button>
    </template>

    <!-- Manual mode -->
    <template v-if="activeMode === 'manual'">
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
        <span v-if="!isLoading && eligibleCount === 0" class="ap__hint">
          <template v-if="!form.supportLevelId">Selecciona un nivel para filtrar.</template>
          <template v-else-if="_pendingCategory">
            Ningún especialista disponible — puede que todos hayan excluido esta categoría.
          </template>
          <template v-else>Ningún especialista en este nivel.</template>
        </span>
      </div>

      <div class="ap__field">
        <label class="ap__label">Razón <span class="ap__label-hint">(opcional)</span></label>
        <input v-model="form.reason" type="text" class="ap__input" placeholder="Motivo de asignación manual" />
      </div>

      <button class="ap__btn ap__btn--manual" :disabled="!canSubmitManual" @click="handleManual">
        <i v-if="submitting === 'manual'" class="bx bx-loader-alt bx-spin"></i>
        <i v-else class="bx bx-check"></i>
        {{ submitting === 'manual' ? 'Asignando...' : 'Confirmar asignación manual' }}
      </button>
    </template>

    <!-- Error -->
    <div v-if="error" class="ap__error">
      <i class="bx bx-error-circle"></i> {{ error }}
    </div>
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

.ap__tabs {
  display: flex;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.ap__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.4rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
  background: var(--bg-main);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.12s;
}

.ap__tab + .ap__tab {
  border-left: 1px solid var(--border-light);
}

.ap__tab--active {
  background: var(--primary-500);
  color: white;
}
.ap__tab--active + .ap__tab,
.ap__tab + .ap__tab--active {
  border-left-color: var(--primary-500);
}

.ap__tab:hover:not(.ap__tab--active):not(:disabled) {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ap__tab:disabled { opacity: 0.55; cursor: not-allowed; }

.ap__btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.48rem;
  font-weight: 700;
  font-size: 0.78rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background 0.12s;
}

.ap__btn--wdd {
  background: var(--primary-500);
  color: white;
}
.ap__btn--wdd:hover:not(:disabled) { background: var(--primary-600); }

.ap__btn--manual {
  background: #6366f1;
  color: white;
}
.ap__btn--manual:hover:not(:disabled) { background: #4f46e5; }

.ap__btn:disabled { opacity: 0.55; cursor: not-allowed; }

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
</style>

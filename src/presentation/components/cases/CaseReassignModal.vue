<script setup>
import { ref, computed, watch } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { CaseAssignContextRepository } from '@/infrastructure/repositories/CaseAssignContextRepository'

const props = defineProps({
  caseData: { type: Object, required: true },
})
const emit = defineEmits(['close', 'done'])

const store     = useCasesStore()
const userStore = useUserStore()

// ── Form state ──
const form = ref({
  supportLevelId:    props.caseData.supportLevelId ?? '',
  newSpecialistId:   '',
  newCategoryId:     '',
  reason:            '',
  note:              '',
})

const submitting = ref(false)
const error      = ref(null)

// ── Context state (two-phase) ──
const availableLevels     = ref([])
const availableCategories = ref([])
const specialists         = ref([])
const loadingCtx          = ref(false)

const _ctxCache = new Map()

// Phase 1 on mount: get available levels + full specialist list
async function loadPhase1() {
  const cacheKey = props.caseData.id
  if (_ctxCache.has(cacheKey)) {
    const c = _ctxCache.get(cacheKey)
    availableLevels.value = c.supportLevels
    return
  }
  loadingCtx.value = true
  try {
    const ctx = await CaseAssignContextRepository.fetchContext(props.caseData.id)
    _ctxCache.set(cacheKey, ctx)
    availableLevels.value = ctx.supportLevels
  } catch { /* silent */ }
  finally { loadingCtx.value = false }
}

// Phase 2: when level changes, reload specialists + categories for that level
watch(() => form.value.supportLevelId, async (levelId) => {
  form.value.newSpecialistId = ''
  form.value.newCategoryId   = ''
  availableCategories.value  = []
  specialists.value          = []

  if (!levelId) return

  const cacheKey = `${props.caseData.id}_${levelId}`
  if (_ctxCache.has(cacheKey)) {
    const c = _ctxCache.get(cacheKey)
    availableCategories.value = c.supportCategories
    specialists.value         = c.specialists.filter(s => s.specialist_id !== props.caseData.specialistId)
    return
  }

  loadingCtx.value = true
  try {
    const ctx = await CaseAssignContextRepository.fetchContext(props.caseData.id, levelId)
    _ctxCache.set(cacheKey, ctx)
    availableCategories.value = ctx.supportCategories
    specialists.value         = ctx.specialists.filter(s => s.specialist_id !== props.caseData.specialistId)
  } catch { /* silent */ }
  finally { loadingCtx.value = false }
}, { immediate: true })

loadPhase1()

// ── Derived state ──
const isDifferentLevel = computed(() =>
  !!form.value.supportLevelId &&
  form.value.supportLevelId !== (props.caseData.supportLevelId ?? '')
)

const specialistsForDropdown = computed(() =>
  [...specialists.value].sort((a, b) => (a.current_count ?? 999) - (b.current_count ?? 999))
)

const currentSpecialistName = computed(() => {
  const sid = props.caseData.specialistId
  if (!sid) return '—'
  const w = store.specialistWorkloads.find(s => s.specialist_id === sid)
  if (w?.full_name) return w.full_name
  const u = userStore.users.find(u => u.specialistId === sid)
  return u?.fullName ?? sid.slice(0, 8)
})

const currentLevelName = computed(() => {
  const lid = props.caseData.supportLevelId
  if (!lid) return null
  return userStore.supportLevels.find(l => l.id === lid)?.name ?? null
})

const canSubmit = computed(() =>
  !submitting.value &&
  !!form.value.supportLevelId &&
  !!form.value.newSpecialistId &&
  !!form.value.reason.trim() &&
  (!isDifferentLevel.value || !!form.value.newCategoryId)
)

// ── Submit ──
async function handleReassign() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = null
  try {
    await store.reassign({
      caseId:               props.caseData.id,
      currentSpecialistId:  props.caseData.specialistId,
      newSpecialistId:      form.value.newSpecialistId,
      reason:               form.value.reason.trim(),
      note:                 form.value.note.trim() || null,
      newSupportLevelId:    isDifferentLevel.value ? form.value.supportLevelId  : null,
      newSupportCategoryId: isDifferentLevel.value ? form.value.newCategoryId   : null,
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
        <!-- Current specialist -->
        <div class="rm__field">
          <label class="rm__label">Especialista actual</label>
          <div class="rm__readonly">
            <i class="bx bx-user-check rm__readonly-icon"></i>
            {{ currentSpecialistName }}
            <span v-if="currentLevelName" class="rm__readonly-level">· {{ currentLevelName }}</span>
          </div>
        </div>

        <!-- Step 1: Support level -->
        <div class="rm__field">
          <label class="rm__label">Nivel de soporte *</label>
          <select v-model="form.supportLevelId" class="rm__select" :disabled="loadingCtx">
            <option value="">{{ loadingCtx ? 'Cargando...' : availableLevels.length ? '— Seleccionar —' : '— Sin niveles —' }}</option>
            <option v-for="lv in availableLevels" :key="lv.id" :value="lv.id">{{ lv.name }}</option>
          </select>
        </div>

        <!-- Step 2: New specialist (unlocked after level) -->
        <div class="rm__field">
          <label class="rm__label">
            Nuevo especialista *
            <span v-if="form.supportLevelId && !loadingCtx" class="rm__label-hint">
              {{ specialists.length }} elegible{{ specialists.length !== 1 ? 's' : '' }}
            </span>
          </label>
          <select
            v-model="form.newSpecialistId"
            class="rm__select"
            :disabled="!form.supportLevelId || loadingCtx"
          >
            <option value="">
              {{ !form.supportLevelId
                ? '— Selecciona un nivel primero —'
                : loadingCtx
                  ? 'Cargando...'
                  : specialists.length
                    ? '— Seleccionar —'
                    : '— Sin especialistas disponibles —' }}
            </option>
            <option v-for="s in specialistsForDropdown" :key="s.specialist_id" :value="s.specialist_id">
              {{ s.full_name }}{{ s.current_count !== null ? ` (${s.current_count} caso${s.current_count !== 1 ? 's' : ''})` : '' }}{{ !s.is_available ? ' · sin turno' : '' }}
            </option>
          </select>
        </div>

        <!-- Step 2b: New category — only when changing level -->
        <transition name="rm-slide">
          <div v-if="isDifferentLevel" class="rm__field rm__field--highlight">
            <label class="rm__label">
              Nueva categoría *
              <span class="rm__label-badge">Nivel cambia</span>
            </label>
            <select v-model="form.newCategoryId" class="rm__select" :disabled="loadingCtx">
              <option value="">{{ loadingCtx ? 'Cargando...' : availableCategories.length ? '— Seleccionar —' : '— Sin categorías —' }}</option>
              <option v-for="cat in availableCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
            <span class="rm__field-note">
              <i class="bx bx-info-circle"></i>
              El nivel cambia, por lo que se requiere definir la nueva categoría.
            </span>
          </div>
        </transition>

        <!-- Reason -->
        <div class="rm__field">
          <label class="rm__label">Razón *</label>
          <input v-model="form.reason" type="text" class="rm__input" placeholder="Motivo de reasignación" />
        </div>

        <!-- Note -->
        <div class="rm__field">
          <label class="rm__label">Nota <span class="rm__label-hint">(opcional)</span></label>
          <textarea v-model="form.note" class="rm__textarea" placeholder="Nota adicional" rows="2"></textarea>
        </div>

        <div v-if="error" class="rm__error">
          <i class="bx bx-error-circle"></i> {{ error }}
        </div>
      </div>

      <div class="rm__footer">
        <button class="rm__btn rm__btn--cancel" @click="emit('close')">Cancelar</button>
        <button
          class="rm__btn rm__btn--submit"
          :disabled="!canSubmit"
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
  background: rgba(10, 12, 20, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  animation: rm-fade 0.15s ease;
}
@keyframes rm-fade { from { opacity: 0; } to { opacity: 1; } }

.rm {
  background: var(--bg-main);
  border-radius: 16px;
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-light);
  animation: rm-pop 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
@keyframes rm-pop { from { transform: translateY(10px) scale(0.98); opacity: 0; } to { transform: none; opacity: 1; } }

.rm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.rm__title {
  font-size: 1.1rem;
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
  transition: background 0.12s;
}
.rm__close:hover { background: var(--bg-card); }

.rm__body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;
}

.rm__field { display: flex; flex-direction: column; gap: 0.25rem; }

.rm__field--highlight {
  padding: 0.65rem 0.75rem;
  background: rgba(42, 199, 143, 0.05);
  border: 1px solid rgba(42, 199, 143, 0.2);
  border-radius: var(--radius-md);
  gap: 0.35rem;
}

.rm__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.rm__label-hint {
  font-size: 0.65rem;
  font-weight: 400;
  opacity: 0.7;
}

.rm__label-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  background: rgba(42, 199, 143, 0.15);
  color: var(--primary-600);
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.rm__readonly {
  padding: 0.45rem 0.6rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.rm__readonly-icon {
  font-size: 0.9rem;
  color: var(--primary-500);
  flex-shrink: 0;
}

.rm__readonly-level {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-left: 0.15rem;
}

.rm__select, .rm__input, .rm__textarea {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
  transition: border-color 0.12s;
}

.rm__select:focus, .rm__input:focus, .rm__textarea:focus {
  border-color: var(--primary-500);
}

.rm__select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-card);
}

.rm__textarea { resize: vertical; }

.rm__field-note {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.67rem;
  color: var(--text-secondary);
  font-style: italic;
}
.rm__field-note i { font-size: 0.75rem; color: var(--primary-500); flex-shrink: 0; }

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
  flex-shrink: 0;
}

.rm__btn {
  flex: 1;
  height: 40px;
  padding: 0 1rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: all 0.15s;
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

/* Slide transition for category field */
.rm-slide-enter-active,
.rm-slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.rm-slide-enter-from,
.rm-slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.rm-slide-enter-to,
.rm-slide-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCascadingSelects } from '@/presentation/composables/useCascadingSelects'

const store = useCasesStore()
const userStore = useUserStore()

const form = ref({
  applicationId: '',
  subject: '',
  description: '',
  priority: 'normal',
  supportLevelId: '',
  supportCategoryId: '',
})

const submitting = ref(false)
const feedback = ref(null)

const applications = computed(() => userStore.applications ?? [])

const { availableLevels, availableCategories, loadingLevels, loadingCategories } =
  useCascadingSelects(
    computed(() => form.value.applicationId),
    computed({ get: () => form.value.supportLevelId, set: v => form.value.supportLevelId = v }),
    computed({ get: () => form.value.supportCategoryId, set: v => form.value.supportCategoryId = v }),
  )

const canSubmit = computed(() =>
  form.value.subject.trim() && form.value.applicationId && !submitting.value
)

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  feedback.value = null

  try {
    const payload = {
      applicationId: form.value.applicationId,
      origin: { type: 'tyflow' },
      subject: form.value.subject.trim(),
      description: form.value.description.trim() || null,
      priority: form.value.priority,
      supportLevelId: form.value.supportLevelId || undefined,
      supportCategoryId: form.value.supportCategoryId || undefined,
    }
    await store.createCase(payload)
    feedback.value = { type: 'success', text: 'Caso creado exitosamente.' }
    setTimeout(() => store.showCreateModal = false, 800)
  } catch (e) {
    feedback.value = { type: 'error', text: store.actionError || e.message || 'Error creando caso' }
  } finally {
    submitting.value = false
  }
}

function close() {
  store.showCreateModal = false
}

function onOverlay(e) {
  if (e.target === e.currentTarget) close()
}
</script>

<template>
  <Teleport to="body">
    <div class="ccm__overlay" @click="onOverlay">
      <div class="ccm__panel">
        <!-- Header -->
        <div class="ccm__header">
          <h3 class="ccm__heading">
            <i class="bx bx-plus-circle"></i> Nuevo caso
          </h3>
          <button class="ccm__close" @click="close" aria-label="Cerrar">
            <i class="bx bx-x"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="ccm__body">
          <!-- Feedback -->
          <div v-if="feedback" class="ccm__feedback" :class="feedback.type === 'success' ? 'ccm__feedback--ok' : 'ccm__feedback--err'">
            <i :class="feedback.type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle'"></i>
            {{ feedback.text }}
          </div>

          <div class="ccm__layout">
            <!-- Main fields -->
            <div class="ccm__main">
              <div class="ccm__field">
                <label class="ccm__label">Asunto *</label>
                <input v-model="form.subject" type="text" class="ccm__input" placeholder="Describe brevemente el caso" />
              </div>
              <div class="ccm__field">
                <label class="ccm__label">Descripción</label>
                <textarea v-model="form.description" class="ccm__textarea" placeholder="Detalle del caso..." rows="4"></textarea>
              </div>
            </div>

            <!-- Config sidebar -->
            <div class="ccm__config">
              <span class="ccm__section-label">Configuración</span>

              <div class="ccm__field">
                <label class="ccm__label">Aplicación *</label>
                <select v-model="form.applicationId" class="ccm__select">
                  <option value="">— Seleccionar —</option>
                  <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
                </select>
              </div>

              <div class="ccm__field">
                <label class="ccm__label">Prioridad</label>
                <div class="ccm__pills">
                  <button
                    v-for="p in ['low', 'normal', 'high', 'urgent']"
                    :key="p"
                    class="ccm__pill"
                    :class="[`ccm__pill--${p}`, { 'ccm__pill--sel': form.priority === p }]"
                    @click="form.priority = p"
                  >{{ p === 'low' ? 'Baja' : p === 'normal' ? 'Normal' : p === 'high' ? 'Alta' : 'Urgente' }}</button>
                </div>
              </div>

              <div class="ccm__field">
                <label class="ccm__label">Nivel de soporte</label>
                <select v-model="form.supportLevelId" class="ccm__select" :disabled="!form.applicationId || loadingLevels">
                  <option value="">{{ loadingLevels ? 'Cargando...' : availableLevels.length ? '— Ninguno —' : '— Seleccione app —' }}</option>
                  <option v-for="lv in availableLevels" :key="lv.id" :value="lv.id">{{ lv.name }}</option>
                </select>
              </div>

              <div class="ccm__field">
                <label class="ccm__label">Categoría de soporte</label>
                <select v-model="form.supportCategoryId" class="ccm__select" :disabled="!form.supportLevelId || loadingCategories">
                  <option value="">{{ loadingCategories ? 'Cargando...' : availableCategories.length ? '— Ninguna —' : '— Seleccione nivel —' }}</option>
                  <option v-for="cat in availableCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="ccm__footer">
          <button class="ccm__btn ccm__btn--cancel" @click="close">Cancelar</button>
          <button class="ccm__btn ccm__btn--submit" :disabled="!canSubmit" @click="handleSubmit">
            <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
            <i v-else class="bx bx-plus"></i>
            {{ submitting ? 'Creando...' : 'Crear Caso' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ccm__overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.ccm__panel {
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.ccm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.ccm__heading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}
.ccm__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.12s;
}
.ccm__close:hover { background: var(--bg-card); color: var(--text-primary); }

/* Body */
.ccm__body {
  flex: 1;
  overflow-y: auto;
  padding: 1.15rem;
}

.ccm__layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 1.25rem;
}

.ccm__main { display: flex; flex-direction: column; gap: 0.75rem; }

.ccm__config {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.ccm__section-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.ccm__field { display: flex; flex-direction: column; gap: 0.25rem; }

.ccm__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.ccm__input, .ccm__textarea, .ccm__select {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
  transition: border-color 0.12s;
}
.ccm__input:focus, .ccm__textarea:focus, .ccm__select:focus {
  border-color: var(--primary-500);
}
.ccm__select:disabled { opacity: 0.5; cursor: not-allowed; }
.ccm__textarea { resize: vertical; min-height: 90px; }

/* Pills */
.ccm__pills { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.ccm__pill {
  flex: 1;
  padding: 0.3rem 0.35rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border-light);
  font-size: 0.68rem;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  transition: all 0.12s;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
}
.ccm__pill--low.ccm__pill--sel { background: var(--priority-low-bg); border-color: var(--priority-low); color: var(--priority-low); }
.ccm__pill--normal.ccm__pill--sel { background: var(--priority-normal-bg); border-color: var(--priority-normal); color: var(--priority-normal); }
.ccm__pill--high.ccm__pill--sel { background: var(--priority-high-bg); border-color: var(--priority-high); color: var(--priority-high); }
.ccm__pill--urgent.ccm__pill--sel { background: var(--priority-urgent-bg); border-color: var(--priority-urgent); color: var(--priority-urgent); }
/* Feedback */
.ccm__feedback {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.85rem;
}
.ccm__feedback--ok { background: var(--success-bg); color: var(--success-text); }
.ccm__feedback--err { background: var(--error-bg); color: var(--error-text); }

/* Footer */
.ccm__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.15rem;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}
.ccm__btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.ccm__btn--cancel {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
}
.ccm__btn--cancel:hover { border-color: var(--text-primary); color: var(--text-primary); }
.ccm__btn--submit {
  background: var(--primary-500);
  color: white;
  border: none;
}
.ccm__btn--submit:hover:not(:disabled) { background: var(--primary-600); }
.ccm__btn--submit:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
  .ccm__overlay { padding: 0; }
  .ccm__panel { max-width: 100%; max-height: 100%; height: 100%; border-radius: 0; }
  .ccm__layout { grid-template-columns: 1fr; }
}
</style>

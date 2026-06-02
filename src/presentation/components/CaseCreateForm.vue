<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'

const store = useCasesStore()
const userStore = useUserStore()

const form = ref({
  applicationId: '',
  source: 'manual',
  subject: '',
  description: '',
  priority: 'normal',
  supportLevelId: '',
  supportCategoryId: '',
})

const submitting = ref(false)
const feedback = ref(null)

const applications = computed(() => userStore.applications ?? [])
const supportLevels = computed(() => userStore.supportLevels ?? [])
const supportCategories = computed(() => userStore.supportCategories ?? [])

const canSubmit = computed(() =>
  form.value.subject.trim() && form.value.applicationId && !submitting.value
)

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  feedback.value = null

  try {
    const payload = {
      application_id: form.value.applicationId,
      source: form.value.source,
      subject: form.value.subject.trim(),
      description: form.value.description.trim() || null,
      priority: form.value.priority,
      support_level_id: form.value.supportLevelId || null,
      support_category_id: form.value.supportCategoryId || null,
    }
    await store.createCase(payload)
    feedback.value = { type: 'success', text: 'Caso creado exitosamente.' }
    resetForm()
  } catch (e) {
    feedback.value = { type: 'error', text: store.error || e.message || 'Error creando caso' }
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  form.value = {
    applicationId: '',
    source: 'manual',
    subject: '',
    description: '',
    priority: 'normal',
    supportLevelId: '',
    supportCategoryId: '',
  }
}
</script>

<template>
  <div class="cf">
    <div class="cf__main">
      <h3 class="cf__heading">Nuevo caso</h3>

      <div class="cf__field">
        <label class="cf__label">Asunto *</label>
        <input v-model="form.subject" type="text" class="cf__input" placeholder="Describe brevemente el caso" />
      </div>

      <div class="cf__field">
        <label class="cf__label">Descripción</label>
        <textarea v-model="form.description" class="cf__textarea" placeholder="Detalle del caso..." rows="5"></textarea>
      </div>
    </div>

    <div class="cf__sidebar">
      <div class="cf__config">
        <span class="cf__section-label">Configuración</span>

        <div class="cf__field">
          <label class="cf__label">Aplicación *</label>
          <select v-model="form.applicationId" class="cf__select">
            <option value="">— Seleccionar —</option>
            <option v-for="app in applications" :key="app.id" :value="app.id">
              {{ app.name }}
            </option>
          </select>
        </div>

        <div class="cf__field">
          <label class="cf__label">Origen</label>
          <div class="cf__pills">
            <button
              v-for="s in ['outlook', 'judit', 'manual']"
              :key="s"
              class="cf__pill"
              :class="[`cf__pill--${s}`, { 'cf__pill--sel': form.source === s }]"
              @click="form.source = s"
            >
              <i :class="'bx ' + (s === 'outlook' ? 'bx-envelope' : s === 'judit' ? 'bx-bot' : 'bx-edit')"></i>
              {{ s === 'outlook' ? 'Outlook' : s === 'judit' ? 'Judit' : 'Manual' }}
            </button>
          </div>
        </div>

        <div class="cf__field">
          <label class="cf__label">Prioridad</label>
          <div class="cf__pills">
            <button
              v-for="p in ['low', 'normal', 'high', 'urgent']"
              :key="p"
              class="cf__pill"
              :class="[`cf__pill--${p}`, { 'cf__pill--sel': form.priority === p }]"
              @click="form.priority = p"
            >{{ p === 'low' ? 'Baja' : p === 'normal' ? 'Normal' : p === 'high' ? 'Alta' : 'Urgente' }}</button>
          </div>
        </div>

        <div class="cf__field">
          <label class="cf__label">Nivel de soporte</label>
          <select v-model="form.supportLevelId" class="cf__select">
            <option value="">— Ninguno —</option>
            <option v-for="lv in supportLevels" :key="lv.id" :value="lv.id">
              {{ lv.name }}
            </option>
          </select>
        </div>

        <div class="cf__field">
          <label class="cf__label">Categoría de soporte</label>
          <select v-model="form.supportCategoryId" class="cf__select">
            <option value="">— Ninguna —</option>
            <option v-for="cat in supportCategories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <button class="cf__submit" :disabled="!canSubmit" @click="handleSubmit">
          <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
          <i v-else class="bx bx-plus"></i>
          {{ submitting ? 'Creando...' : 'Crear Caso' }}
        </button>
      </div>

      <div v-if="feedback" class="cf__feedback" :class="feedback.type === 'success' ? 'cf__feedback--ok' : 'cf__feedback--err'">
        <i :class="feedback.type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle'"></i>
        {{ feedback.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.cf {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.5rem;
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .cf { grid-template-columns: 1fr; }
}

.cf__heading {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.cf__main { display: flex; flex-direction: column; gap: 0.85rem; }
.cf__sidebar { display: flex; flex-direction: column; gap: 0.85rem; }

.cf__config {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cf__section-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.cf__field { display: flex; flex-direction: column; gap: 0.3rem; }

.cf__label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.cf__input, .cf__textarea, .cf__select {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;
}

.cf__input:focus, .cf__textarea:focus, .cf__select:focus {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(42, 199, 143, 0.1);
}

.cf__textarea { resize: vertical; min-height: 120px; }

/* Pills */
.cf__pills { display: flex; gap: 0.35rem; flex-wrap: wrap; }

.cf__pill {
  flex: 1;
  padding: 0.35rem 0.4rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border-light);
  font-size: 0.7rem;
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

.cf__pill--low.cf__pill--sel { background: var(--priority-low-bg); border-color: var(--priority-low); color: var(--priority-low); }
.cf__pill--normal.cf__pill--sel { background: var(--priority-normal-bg); border-color: var(--priority-normal); color: var(--priority-normal); }
.cf__pill--high.cf__pill--sel { background: var(--priority-high-bg); border-color: var(--priority-high); color: var(--priority-high); }
.cf__pill--urgent.cf__pill--sel { background: var(--priority-urgent-bg); border-color: var(--priority-urgent); color: var(--priority-urgent); }

.cf__pill--outlook.cf__pill--sel { background: var(--source-outlook-bg); border-color: var(--source-outlook); color: var(--source-outlook); }
.cf__pill--judit.cf__pill--sel { background: var(--source-judit-bg); border-color: var(--source-judit); color: var(--source-judit); }
.cf__pill--manual.cf__pill--sel { background: var(--source-manual-bg); border-color: var(--source-manual); color: var(--source-manual); }

/* Submit */
.cf__submit {
  width: 100%;
  padding: 0.65rem;
  background: var(--primary-500);
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: background 0.12s;
  margin-top: 0.25rem;
}
.cf__submit:hover:not(:disabled) { background: var(--primary-600); }
.cf__submit:disabled { opacity: 0.55; cursor: not-allowed; }

/* Feedback */
.cf__feedback {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
}
.cf__feedback--ok { background: var(--success-bg); color: var(--success-text); }
.cf__feedback--err { background: var(--error-bg); color: var(--error-text); }
</style>

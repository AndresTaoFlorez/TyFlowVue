<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'

const store = useCasesStore()
const userStore = useUserStore()

const subject = ref('')
const body = ref('')
const fromAddress = ref('')
const folderId = ref('')
const priority = ref('P3')
const assignMode = ref('wdd')
const selectedSpecialist = ref('')
const submitting = ref(false)
const feedback = ref(null) // { type: 'success'|'error', text }

const applications = computed(() => userStore.applications ?? [])
const specialists = computed(() => store.specialistWorkloads)

async function handleSubmit() {
  if (!subject.value.trim() || !folderId.value) return
  submitting.value = true
  feedback.value = null

  try {
    const payload = {
      subject: subject.value.trim(),
      body: body.value.trim(),
      fromAddress: fromAddress.value.trim(),
      folderId: folderId.value,
      tags: [priority.value],
    }

    if (assignMode.value === 'wdd') {
      const result = await store.createAndAutoAssign(payload)
      if (result.wddError) {
        feedback.value = { type: 'error', text: result.wddError }
      } else {
        feedback.value = { type: 'success', text: 'Caso creado y asignado automáticamente.' }
        resetForm()
      }
    } else {
      const result = await store.createWithoutAssign(payload)
      if (selectedSpecialist.value && result.conversation) {
        await store.manualAssign({
          conversationId: result.conversation.id,
          specialistId: selectedSpecialist.value,
        })
        feedback.value = { type: 'success', text: 'Caso creado y asignado manualmente.' }
      } else {
        feedback.value = { type: 'success', text: 'Caso creado. Pendiente de asignación.' }
      }
      resetForm()
    }
  } catch (e) {
    feedback.value = { type: 'error', text: store.error || e.message || 'Error creando caso' }
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  subject.value = ''
  body.value = ''
  fromAddress.value = ''
  folderId.value = ''
  priority.value = 'P3'
  assignMode.value = 'wdd'
  selectedSpecialist.value = ''
}
</script>

<template>
  <div class="cf">
    <div class="cf__main">
      <h3 class="cf__heading">Nuevo caso</h3>

      <div class="cf__field">
        <label class="cf__label">Asunto *</label>
        <input v-model="subject" type="text" class="cf__input" placeholder="Describe brevemente el caso" />
      </div>

      <div class="cf__field">
        <label class="cf__label">Descripción</label>
        <textarea v-model="body" class="cf__textarea" placeholder="Detalle del caso..." rows="5"></textarea>
      </div>

      <div class="cf__field">
        <label class="cf__label">Remitente</label>
        <input v-model="fromAddress" type="email" class="cf__input" placeholder="correo@empresa.com" />
      </div>
    </div>

    <div class="cf__sidebar">
      <div class="cf__config">
        <span class="cf__section-label">Configuración</span>

        <div class="cf__field">
          <label class="cf__label">Prioridad</label>
          <div class="cf__pills">
            <button
              v-for="p in ['P1', 'P2', 'P3']"
              :key="p"
              class="cf__pill"
              :class="[`cf__pill--${p.toLowerCase()}`, { 'cf__pill--sel': priority === p }]"
              @click="priority = p"
            >{{ p }}</button>
          </div>
        </div>

        <div class="cf__field">
          <label class="cf__label">Aplicación *</label>
          <select v-model="folderId" class="cf__select">
            <option value="">— Seleccionar —</option>
            <option v-for="app in applications" :key="app.id" :value="app.id">
              {{ app.name }}
            </option>
          </select>
        </div>

        <div class="cf__field">
          <label class="cf__label">Asignación</label>
          <div class="cf__modes">
            <label class="cf__mode" :class="{ 'cf__mode--on': assignMode === 'wdd' }">
              <input type="radio" v-model="assignMode" value="wdd" /> <i class="bx bx-bot"></i> WDD Auto
            </label>
            <label class="cf__mode" :class="{ 'cf__mode--on': assignMode === 'manual' }">
              <input type="radio" v-model="assignMode" value="manual" /> <i class="bx bx-user"></i> Manual
            </label>
          </div>
        </div>

        <div v-if="assignMode === 'manual'" class="cf__field">
          <select v-model="selectedSpecialist" class="cf__select">
            <option value="">— Especialista —</option>
            <option v-for="s in specialists" :key="s.specialist_id" :value="s.specialist_id">
              {{ s.full_name }} ({{ s.current_count ?? 0 }} casos)
            </option>
          </select>
        </div>

        <button class="cf__submit" :disabled="submitting || !subject.trim() || !folderId" @click="handleSubmit">
          <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
          <i v-else class="bx bx-plus"></i>
          {{ submitting ? 'Creando...' : 'Crear Caso' }}
        </button>
      </div>

      <!-- Feedback -->
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
  grid-template-columns: 1fr 280px;
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

/* Priority pills */
.cf__pills { display: flex; gap: 0.35rem; }

.cf__pill {
  flex: 1;
  padding: 0.35rem 0;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border-light);
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  transition: all 0.12s;
  background: transparent;
  color: var(--text-secondary);
}

.cf__pill--p1.cf__pill--sel { background: var(--priority-p1-bg); border-color: var(--priority-p1); color: var(--priority-p1); }
.cf__pill--p2.cf__pill--sel { background: var(--priority-p2-bg); border-color: var(--priority-p2); color: var(--priority-p2); }
.cf__pill--p3.cf__pill--sel { background: var(--priority-p3-bg); border-color: var(--priority-p3); color: var(--priority-p3); }

/* Assign mode */
.cf__modes { display: flex; gap: 0.4rem; }
.cf__mode {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.4rem 0.7rem; border-radius: var(--radius-md);
  border: 1.5px solid var(--border-light);
  font-size: 0.78rem; font-weight: 600;
  color: var(--text-secondary); cursor: pointer;
  transition: all 0.12s;
}
.cf__mode input { display: none; }
.cf__mode--on {
  border-color: var(--primary-500);
  color: var(--primary-600);
  background: rgba(42, 199, 143, 0.06);
}

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

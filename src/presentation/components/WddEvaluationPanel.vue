<script setup>
import { ref, computed, watch } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

const store = useCasesStore()

const assignMode = ref('wdd') // 'wdd' | 'manual'
const selectedSpecialist = ref('')

const c = computed(() => store.selectedCase)
const result = computed(() => store.evaluationResult)

// Stepper
const STEPS = [
  { icon: 'bx-filter', title: 'Categoría', desc: 'Filtrar por aplicación' },
  { icon: 'bx-time-five', title: 'Disponibilidad', desc: 'Verificar ventanas activas' },
  { icon: 'bx-bar-chart', title: 'Carga', desc: 'Evaluar capacidad' },
  { icon: 'bx-user-check', title: 'Selección', desc: 'Asignar mejor opción' },
]

const completedSteps = ref([])
const currentStep = ref(-1)

function resetStepper() {
  completedSteps.value = []
  currentStep.value = -1
}

async function animateStepper() {
  resetStepper()
  for (let i = 0; i < STEPS.length; i++) {
    currentStep.value = i
    await new Promise(r => setTimeout(r, 600))
    completedSteps.value.push(i)
  }
}

async function handleAssign() {
  if (!c.value) return

  if (assignMode.value === 'wdd') {
    animateStepper() // fire & forget — runs visually in parallel
    await store.createAndAutoAssign({
      subject: c.value.subject,
      body: c.value.body,
      fromAddress: c.value.fromAddress,
      folderId: c.value.folderId,
      tags: c.value.tags ?? [],
    })
    // Ensure all steps are marked done
    completedSteps.value = [0, 1, 2, 3]
    currentStep.value = -1
  } else {
    if (!selectedSpecialist.value) return
    await store.manualAssign({
      conversationId: c.value.id,
      specialistId: selectedSpecialist.value,
    })
  }
}

function stepState(i) {
  if (completedSteps.value.includes(i)) return 'done'
  if (currentStep.value === i) return 'active'
  return 'idle'
}

watch(c, resetStepper)

const specialists = computed(() => store.specialistWorkloads)
</script>

<template>
  <div class="ep">
    <!-- Empty state -->
    <div v-if="!c" class="ep__empty">
      <i class="bx bx-select-multiple"></i>
      <p>Selecciona un caso de la cola para evaluarlo</p>
    </div>

    <template v-else>
      <!-- Case header -->
      <div class="ep__header">
        <div class="ep__header-row">
          <span class="ep__case-id">{{ c.shortId }}</span>
          <span class="ep__badge" :style="{ background: c.priorityBg, color: c.priorityColor }">{{ c.priority }}</span>
          <span class="ep__origin" :style="{ background: c.originBg, color: c.originColor }">
            <i :class="'bx ' + c.originIcon"></i> {{ c.originLabel }}
          </span>
        </div>
        <h3 class="ep__subject">{{ c.subject || '(Sin asunto)' }}</h3>
        <div class="ep__meta">
          <span v-if="c.fromAddress"><i class="bx bx-envelope"></i> {{ c.fromAddress }}</span>
          <span v-if="c.waitingTime"><i class="bx bx-time-five"></i> {{ c.waitingTime }}</span>
        </div>
      </div>

      <hr class="ep__divider" />

      <!-- Assignment mode -->
      <div class="ep__section">
        <span class="ep__section-label">Asignación</span>
        <div class="ep__mode-row">
          <label class="ep__mode" :class="{ 'ep__mode--active': assignMode === 'wdd' }">
            <input type="radio" v-model="assignMode" value="wdd" />
            <i class="bx bx-bot"></i> WDD Automático
          </label>
          <label class="ep__mode" :class="{ 'ep__mode--active': assignMode === 'manual' }">
            <input type="radio" v-model="assignMode" value="manual" />
            <i class="bx bx-user"></i> Manual
          </label>
        </div>

        <select v-if="assignMode === 'manual'" v-model="selectedSpecialist" class="ep__select">
          <option value="">— Seleccionar especialista —</option>
          <option v-for="s in specialists" :key="s.specialist_id" :value="s.specialist_id">
            {{ s.full_name }} ({{ s.current_count ?? 0 }} casos)
          </option>
        </select>
        <p v-else class="ep__hint">El sistema asignará automáticamente al mejor especialista disponible.</p>
      </div>

      <button class="ep__btn" :disabled="store.assigning || (assignMode === 'manual' && !selectedSpecialist)" @click="handleAssign">
        <i v-if="store.assigning" class="bx bx-loader-alt bx-spin"></i>
        <i v-else class="bx bx-play"></i>
        {{ store.assigning ? 'Evaluando...' : 'Asignar' }}
      </button>

      <!-- Stepper (only for WDD) -->
      <div v-if="assignMode === 'wdd' && currentStep >= 0" class="ep__stepper">
        <div v-for="(step, i) in STEPS" :key="i" class="ep__step" :class="'ep__step--' + stepState(i)">
          <div class="ep__step-icon">
            <i v-if="stepState(i) === 'done'" class="bx bx-check"></i>
            <i v-else-if="stepState(i) === 'active'" class="bx bx-loader-alt bx-spin"></i>
            <i v-else :class="'bx ' + step.icon"></i>
          </div>
          <div class="ep__step-text">
            <span class="ep__step-title">{{ step.title }}</span>
            <span class="ep__step-desc">{{ step.desc }}</span>
          </div>
        </div>
      </div>

      <!-- Result -->
      <div v-if="result && !result.wddError" class="ep__result ep__result--success">
        <i class="bx bx-check-circle"></i>
        <div>
          <strong>Asignado exitosamente</strong>
          <p v-if="result.assignmentId">ID: {{ result.assignmentId }}</p>
        </div>
      </div>

      <div v-if="result?.wddError" class="ep__result ep__result--error">
        <i class="bx bx-error-circle"></i>
        <div>
          <strong>Error en asignación</strong>
          <p>{{ result.wddError }}</p>
        </div>
      </div>

      <div v-if="store.error" class="ep__result ep__result--error">
        <i class="bx bx-error-circle"></i>
        <div>{{ store.error }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ep {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  padding: 1.25rem;
  overflow-y: auto;
  background: var(--bg-card);
}

.ep__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  gap: 0.5rem;
}
.ep__empty i { font-size: 2.5rem; opacity: 0.3; }
.ep__empty p { font-size: 0.88rem; }

/* Header */
.ep__header { display: flex; flex-direction: column; gap: 0.35rem; }
.ep__header-row { display: flex; align-items: center; gap: 0.4rem; }
.ep__case-id { font-family: monospace; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
.ep__badge, .ep__origin {
  display: inline-flex; align-items: center; gap: 0.15rem;
  padding: 0.08rem 0.4rem; border-radius: var(--radius-sm);
  font-size: 0.62rem; font-weight: 700;
}
.ep__subject { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
.ep__meta { display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-secondary); }
.ep__meta i { font-size: 0.82rem; vertical-align: -1px; margin-right: 0.15rem; }

.ep__divider { border: none; border-top: 1px solid var(--border-light); margin: 0; }

/* Section */
.ep__section-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.ep__mode-row { display: flex; gap: 0.5rem; margin-bottom: 0.65rem; }
.ep__mode {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.45rem 0.85rem; border-radius: var(--radius-md);
  border: 1.5px solid var(--border-light);
  font-size: 0.82rem; font-weight: 600;
  color: var(--text-secondary); cursor: pointer;
  transition: all 0.12s;
}
.ep__mode input { display: none; }
.ep__mode--active {
  border-color: var(--primary-500);
  color: var(--primary-600);
  background: rgba(42, 199, 143, 0.06);
}

.ep__select {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: var(--text-primary);
  background: var(--bg-main);
}
.ep__select:focus { outline: none; border-color: var(--primary-500); }

.ep__hint { font-size: 0.75rem; color: var(--text-secondary); font-style: italic; }

/* Button */
.ep__btn {
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  padding: 0.65rem;
  background: var(--primary-500); color: white;
  font-weight: 700; font-size: 0.88rem;
  border-radius: var(--radius-md); border: none;
  cursor: pointer;
  transition: background 0.12s;
}
.ep__btn:hover:not(:disabled) { background: var(--primary-600); }
.ep__btn:disabled { opacity: 0.55; cursor: not-allowed; }

/* Stepper */
.ep__stepper {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  padding: 0.85rem;
  border: 1px solid var(--border-light);
}

.ep__step {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0;
  transition: opacity 0.3s;
}

.ep__step-icon {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.95rem;
  flex-shrink: 0;
  transition: all 0.3s;
}

.ep__step--idle .ep__step-icon { background: var(--priority-p3-bg); color: var(--priority-p3); }
.ep__step--active .ep__step-icon { background: #DBEAFE; color: #2563EB; }
.ep__step--done .ep__step-icon { background: var(--success-bg); color: var(--success-text); }

.ep__step-text { display: flex; flex-direction: column; }
.ep__step-title { font-size: 0.78rem; font-weight: 600; color: var(--text-primary); }
.ep__step-desc { font-size: 0.68rem; color: var(--text-secondary); }

/* Result */
.ep__result {
  display: flex; align-items: flex-start; gap: 0.65rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
}
.ep__result i { font-size: 1.4rem; flex-shrink: 0; margin-top: 0.1rem; }
.ep__result strong { display: block; margin-bottom: 0.15rem; }
.ep__result p { font-size: 0.78rem; opacity: 0.85; margin: 0; }

.ep__result--success {
  background: var(--success-bg);
  color: var(--success-text);
  border: 1px solid rgba(6, 95, 70, 0.15);
}
.ep__result--error {
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid rgba(153, 27, 27, 0.15);
}
</style>

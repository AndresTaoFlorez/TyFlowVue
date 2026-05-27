<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  context: { type: Object, default: null },
  supportLevels: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'create'])

const name = ref('')
const specialistId = ref(null)
const supportLevelId = ref(null)
const creating = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    name.value = ''
    specialistId.value = null
    supportLevelId.value = null
    creating.value = false
  }
})

const mode = computed(() => props.context?.mode || 'new-app-folder')

const title = computed(() => {
  const titles = {
    'new-app-folder': 'Nueva Bandeja',
    'new-level': 'Nuevo Nivel',
    'new-specialist': 'Nueva Carpeta de Especialista',
    'new-subfolder': 'Nueva Subcarpeta',
  }
  return titles[mode.value] || 'Nueva Carpeta'
})

const canSubmit = computed(() => {
  if (!name.value.trim()) return false
  if (mode.value === 'new-level' && !supportLevelId.value) return false
  if (mode.value === 'new-specialist' && !specialistId.value) return false
  return true
})

function handleSubmit() {
  if (!canSubmit.value || creating.value) return
  creating.value = true

  const data = { name: name.value.trim() }

  if (mode.value === 'new-app-folder') {
    data.type = 'main_box'
  } else if (mode.value === 'new-level') {
    data.type = 'level'
    data.parentFolderId = props.context.parentId
    data.supportLevelId = supportLevelId.value
  } else if (mode.value === 'new-specialist') {
    data.type = 'specialist'
    data.parentFolderId = props.context.parentId
    data.specialistId = specialistId.value
  } else if (mode.value === 'new-subfolder') {
    data.type = 'specialist'
    data.parentFolderId = props.context.parentId
    data.specialistId = props.context.specialistId
  }

  emit('create', data)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-panel">
        <div class="modal-panel__header">
          <h3>{{ title }}</h3>
          <button @click="$emit('close')" class="modal-panel__close"><i class='bx bx-x'></i></button>
        </div>

        <div class="modal-panel__body">
          <!-- Name (always shown) -->
          <div class="field">
            <label class="field__label">Nombre</label>
            <input
              v-model="name"
              type="text"
              class="field__input"
              placeholder="Nombre de la carpeta"
              @keyup.enter="handleSubmit"
            >
          </div>

          <!-- Support level (only for new-level) -->
          <div v-if="mode === 'new-level'" class="field">
            <label class="field__label">Nivel de soporte</label>
            <select v-model="supportLevelId" class="field__select">
              <option :value="null" disabled>Seleccionar nivel...</option>
              <option v-for="sl in supportLevels" :key="sl.id" :value="sl.id">
                {{ sl.name }}
              </option>
            </select>
          </div>

          <!-- Specialist (only for new-specialist) -->
          <div v-if="mode === 'new-specialist'" class="field">
            <label class="field__label">Especialista</label>
            <select v-model="specialistId" class="field__select">
              <option :value="null" disabled>Seleccionar especialista...</option>
              <option
                v-for="s in context?.availableSpecialists || []"
                :key="s.specialistId"
                :value="s.specialistId"
              >
                {{ s.fullName }}
              </option>
            </select>
          </div>

          <!-- Info hint for subfolder mode -->
          <p v-if="mode === 'new-subfolder'" class="field__hint">
            El especialista se hereda automáticamente de la carpeta padre.
          </p>
        </div>

        <div class="modal-panel__footer">
          <button @click="$emit('close')" class="btn-secondary">Cancelar</button>
          <button @click="handleSubmit" class="btn-primary" :disabled="!canSubmit || creating">
            <i v-if="creating" class='bx bx-loader-alt bx-spin'></i>
            <i v-else class='bx bx-plus'></i>
            Crear
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal-panel {
  background: white;
  width: 100%;
  max-width: 440px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-panel__header h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-panel__close {
  background: none;
  border: none;
  font-size: 1.4rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-panel__body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-panel__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  background: #fafafa;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.field__input,
.field__select {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-primary);
  background: white;
  outline: none;
  transition: border-color 0.15s;
}

.field__input:focus,
.field__select:focus {
  border-color: var(--primary-500);
}

.field__hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-style: italic;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  background: white;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.5rem 1rem;
  font-size: 0.82rem;
  font-weight: 600;
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) { background: var(--primary-600); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

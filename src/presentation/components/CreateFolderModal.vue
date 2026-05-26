<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  folders: { type: Array, default: () => [] },
  specialists: { type: Array, default: () => [] },
  supportLevels: { type: Array, default: () => [] },
  prefill: { type: Object, default: null },
})

const emit = defineEmits(['close', 'create'])

const form = ref({
  type: 'main_box',
  name: '',
  parentFolderId: null,
  specialistId: null,
  supportLevelId: null,
})

const resetForm = () => {
  form.value = {
    type: 'main_box',
    name: '',
    parentFolderId: null,
    specialistId: null,
    supportLevelId: null,
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    resetForm()
    if (props.prefill) {
      form.value.type = props.prefill.type || 'specialist'
      form.value.parentFolderId = props.prefill.parentFolderId || null
    }
  }
})

// Carpetas que pueden ser padre según el tipo seleccionado
const parentOptions = computed(() => {
  if (form.value.type === 'main_box') return []
  return props.folders.filter(f => {
    if (form.value.type === 'level') return f.type === 'main_box'
    if (form.value.type === 'specialist') return f.type === 'level' || f.type === 'specialist'
    return false
  })
})

const canSubmit = computed(() => {
  if (!form.value.name.trim()) return false
  if (form.value.type === 'level') {
    return form.value.parentFolderId && form.value.supportLevelId
  }
  if (form.value.type === 'specialist') {
    return form.value.parentFolderId && form.value.specialistId
  }
  return true
})

const handleSubmit = () => {
  if (!canSubmit.value) return
  emit('create', {
    type: form.value.type,
    name: form.value.name.trim(),
    parentFolderId: form.value.type !== 'main_box' ? form.value.parentFolderId : null,
    specialistId: form.value.type === 'specialist' ? form.value.specialistId : null,
    supportLevelId: form.value.type === 'level' ? form.value.supportLevelId : null,
  })
}

// Reset dependant fields on type change
watch(() => form.value.type, () => {
  form.value.parentFolderId = null
  form.value.specialistId = null
  form.value.supportLevelId = null
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-panel">
        <div class="modal-panel__header">
          <h3>Nueva Carpeta</h3>
          <button @click="$emit('close')" class="modal-panel__close"><i class='bx bx-x'></i></button>
        </div>

        <div class="modal-panel__body">
          <!-- Type -->
          <div class="field">
            <label class="field__label">Tipo</label>
            <div class="field__radios">
              <label class="radio-opt" :class="{ 'radio-opt--active': form.type === 'main_box' }">
                <input type="radio" v-model="form.type" value="main_box" class="radio-opt__input">
                <i class='bx bx-inbox'></i> Bandeja
              </label>
              <label class="radio-opt" :class="{ 'radio-opt--active': form.type === 'level' }">
                <input type="radio" v-model="form.type" value="level" class="radio-opt__input">
                <i class='bx bx-layer'></i> Nivel
              </label>
              <label class="radio-opt" :class="{ 'radio-opt--active': form.type === 'specialist' }">
                <input type="radio" v-model="form.type" value="specialist" class="radio-opt__input">
                <i class='bx bx-user'></i> Especialista
              </label>
            </div>
          </div>

          <!-- Name -->
          <div class="field">
            <label class="field__label">Nombre</label>
            <input v-model="form.name" type="text" class="field__input" placeholder="Nombre de la carpeta">
          </div>

          <!-- Parent folder (level / specialist) -->
          <div v-if="form.type !== 'main_box'" class="field">
            <label class="field__label">Carpeta padre</label>
            <select v-model="form.parentFolderId" class="field__select">
              <option :value="null" disabled>Seleccionar carpeta padre...</option>
              <option v-for="f in parentOptions" :key="f.id" :value="f.id">
                {{ f.name }} ({{ f.type.replace('_', ' ') }})
              </option>
            </select>
          </div>

          <!-- Support level (level type) -->
          <div v-if="form.type === 'level'" class="field">
            <label class="field__label">Nivel de soporte</label>
            <select v-model="form.supportLevelId" class="field__select">
              <option :value="null" disabled>Seleccionar nivel...</option>
              <option v-for="sl in supportLevels" :key="sl.id" :value="sl.id">
                {{ sl.name }}
              </option>
            </select>
          </div>

          <!-- Specialist (specialist type) -->
          <div v-if="form.type === 'specialist'" class="field">
            <label class="field__label">Especialista</label>
            <select v-model="form.specialistId" class="field__select">
              <option :value="null" disabled>Seleccionar especialista...</option>
              <option v-for="s in specialists" :key="s.specialistId" :value="s.specialistId">
                {{ s.fullName }}
              </option>
            </select>
          </div>

          <!-- Error -->
          <p v-if="error" class="field__error">{{ error }}</p>
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

/* Fields */
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

.field__error {
  font-size: 0.8rem;
  color: var(--error-500);
  margin-top: 0.25rem;
}

/* Radio type selector */
.field__radios {
  display: flex;
  gap: 0.4rem;
}

.radio-opt {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.radio-opt__input {
  display: none;
}

.radio-opt:hover {
  border-color: var(--primary-500);
  color: var(--primary-500);
}

.radio-opt--active {
  border-color: var(--primary-500);
  background: rgba(42, 199, 143, 0.08);
  color: var(--primary-500);
}

.radio-opt i {
  font-size: 1rem;
}

/* Buttons */
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

.btn-primary:hover:not(:disabled) {
  background: var(--primary-600);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

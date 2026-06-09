<script setup>
defineProps({
  supportLevels: { type: Array, required: true },
  applications: { type: Array, required: true },
  modelValue: { type: Array, default: () => [] }, // [{application_id, support_level_id}]
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: null },
})

const emit = defineEmits(['update:modelValue'])

function addRow(props) {
  emit('update:modelValue', [...props.modelValue, { application_id: '', support_level_id: '' }])
}

function removeRow(props, idx) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== idx))
}

function setLevel(props, idx, levelId) {
  emit('update:modelValue', props.modelValue.map((row, i) =>
    i === idx ? { ...row, support_level_id: levelId, application_id: '' } : row
  ))
}

function setApp(props, idx, appId) {
  emit('update:modelValue', props.modelValue.map((row, i) =>
    i === idx ? { ...row, application_id: appId } : row
  ))
}

function usedApps(props, excludeIdx) {
  return props.modelValue
    .filter((_, i) => i !== excludeIdx)
    .map(r => r.application_id)
    .filter(Boolean)
}
</script>

<template>
  <div class="sf">
    <div class="sf__header">
      <span class="sf__label">Aplicaciones asignadas</span>
      <span v-if="error" class="sf__err">{{ error }}</span>
    </div>

    <div class="sf__rows">
      <div v-if="modelValue.length === 0" class="sf__empty">
        Sin asignaciones. Agrega una aplicación con su nivel de soporte.
      </div>

      <div v-for="(row, idx) in modelValue" :key="idx" class="sf__row">
        <!-- Nivel primero -->
        <div class="sf__field">
          <label class="sf__field-label">Nivel *</label>
          <select
            class="sf__select"
            :class="{ 'sf__select--placeholder': !row.support_level_id }"
            :value="row.support_level_id"
            :disabled="disabled || loading"
            @change="setLevel($props, idx, $event.target.value)"
          >
            <option value="">Seleccionar nivel...</option>
            <option v-for="l in supportLevels" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>

        <!-- Aplicación — deshabilitada hasta que haya nivel -->
        <div class="sf__field sf__field--app">
          <label class="sf__field-label">
            Aplicación *
            <span v-if="!row.support_level_id" class="sf__field-hint">requiere nivel</span>
          </label>
          <select
            class="sf__select"
            :class="{ 'sf__select--placeholder': !row.application_id }"
            :value="row.application_id"
            :disabled="disabled || loading || !row.support_level_id"
            :title="!row.support_level_id ? 'Selecciona primero un nivel de soporte' : ''"
            @change="setApp($props, idx, $event.target.value)"
          >
            <option value="">Seleccionar aplicación...</option>
            <option
              v-for="a in applications"
              :key="a.id"
              :value="a.id"
              :disabled="usedApps($props, idx).includes(a.id)"
            >{{ a.name }}</option>
          </select>
        </div>

        <!-- Quitar -->
        <button
          type="button"
          class="sf__remove"
          :disabled="disabled"
          title="Quitar asignación"
          @click="removeRow($props, idx)"
        >
          <i class="bx bx-x"></i>
        </button>
      </div>
    </div>

    <button
      v-if="!disabled"
      type="button"
      class="sf__add"
      :disabled="loading"
      @click="addRow($props)"
    >
      <i class="bx bx-plus"></i>
      Agregar aplicación
    </button>
  </div>
</template>

<style scoped>
.sf {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.sf__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sf__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sf__err {
  font-size: 0.72rem;
  color: var(--error, #e53e3e);
}

.sf__empty {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-style: italic;
}

.sf__rows {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sf__row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.sf__field {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  flex: 1;
}

.sf__field--app { flex: 2; }

.sf__field-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

.sf__field-hint {
  font-size: 0.6rem;
  font-weight: 400;
  color: var(--text-secondary);
  opacity: 0.7;
  font-style: italic;
  text-transform: none;
  letter-spacing: 0;
}

.sf__select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  color: var(--text-primary);
  background: var(--bg-main);
  width: 100%;
  outline: none;
  cursor: pointer;
  transition: border-color 0.12s;
}

.sf__select:focus { border-color: var(--primary-500); }
.sf__select:disabled { opacity: 0.45; cursor: not-allowed; }
.sf__select--placeholder { color: var(--text-secondary); }

.sf__remove {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: border-color 0.12s, color 0.12s;
}

.sf__remove:hover:not(:disabled) {
  border-color: #e53e3e;
  color: #e53e3e;
}

.sf__remove:disabled { opacity: 0.35; cursor: not-allowed; }

.sf__add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.6rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}

.sf__add:hover:not(:disabled) {
  border-color: var(--primary-500);
  color: var(--primary-500);
}

.sf__add i { font-size: 0.85rem; }
</style>

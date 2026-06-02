<script setup>
const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: Array, required: true },
  label: { type: String, default: null },
  icon: { type: String, default: null },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  emptyText: { type: String, default: 'Sin opciones disponibles' },
  color: { type: String, default: 'primary' },
  error: { type: String, default: null },
  lockedIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const toggle = (id) => {
  if (props.lockedIds.includes(id)) return
  const current = [...props.modelValue]
  const idx = current.indexOf(id)
  if (idx === -1) current.push(id)
  else current.splice(idx, 1)
  emit('update:modelValue', current)
}

const isSelected = (id) => props.modelValue.includes(id)
const isLocked = (id) => props.lockedIds.includes(id)
</script>

<template>
  <div class="chip-select" :class="{ 'chip-select--error': error }">
    <label v-if="label" class="chip-select__label">
      <i v-if="icon" class='bx' :class="icon"></i>
      {{ label }}
    </label>

    <div v-if="loading" class="chip-select__loading">
      <i class='bx bx-loader-alt bx-spin'></i> Cargando...
    </div>

    <div v-else-if="options.length === 0" class="chip-select__empty">
      {{ emptyText }}
    </div>

    <div v-else class="chip-select__chips">
      <button
        v-for="opt in options"
        :key="opt.id"
        type="button"
        class="chip"
        :class="[
          `chip--${color}`,
          {
            'chip--active': isSelected(opt.id),
            'chip--locked': isLocked(opt.id),
          }
        ]"
        :disabled="disabled || isLocked(opt.id)"
        @click="toggle(opt.id)"
      >
        <i class='bx' :class="isSelected(opt.id) ? 'bx-check' : 'bx-plus'"></i>
        {{ opt.displayName || opt.name }}
      </button>
    </div>

    <span v-if="error" class="chip-select__error">{{ error }}</span>
  </div>
</template>

<style scoped>
.chip-select {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chip-select__label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.chip-select__label i {
  font-size: 1rem;
}

.chip-select__loading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  padding: 0.5rem 0;
}

.chip-select__empty {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-style: italic;
  padding: 0.5rem 0;
}

.chip-select__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip-select__error {
  color: var(--error-500);
  font-size: 0.75rem;
  font-weight: 500;
}

.chip-select--error .chip-select__chips {
  padding: 0.5rem;
  border: 1.5px solid var(--error-500);
  border-radius: var(--radius-md);
  background: var(--input-error-bg);
}

/* ---- Chip base ---- */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full, 9999px);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1.5px solid var(--border-light);
  background: var(--bg-main);
  color: var(--text-secondary);
}

.chip i {
  font-size: 0.85rem;
  transition: transform 0.15s ease;
}

.chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chip--locked {
  opacity: 0.85;
  cursor: default;
}

/* ---- Color: primary (green) ---- */
.chip--primary:hover:not(:disabled) {
  border-color: var(--primary-500);
  color: var(--primary-500);
}

.chip--primary.chip--active {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: white;
  font-weight: 600;
}

.chip--primary.chip--active:hover:not(:disabled) {
  background: var(--primary-600, #22a876);
  border-color: var(--primary-600, #22a876);
  color: white;
}

/* ---- Color: indigo ---- */
.chip--indigo:hover:not(:disabled) {
  border-color: #4F46E5;
  color: #4F46E5;
}

.chip--indigo.chip--active {
  background: #4F46E5;
  border-color: #4F46E5;
  color: white;
  font-weight: 600;
}

.chip--indigo.chip--active:hover:not(:disabled) {
  background: #4338CA;
  border-color: #4338CA;
  color: white;
}

/* ---- Color: blue ---- */
.chip--blue:hover:not(:disabled) {
  border-color: #2563EB;
  color: #2563EB;
}

.chip--blue.chip--active {
  background: #2563EB;
  border-color: #2563EB;
  color: white;
  font-weight: 600;
}

.chip--blue.chip--active:hover:not(:disabled) {
  background: #1D4ED8;
  border-color: #1D4ED8;
  color: white;
}

/* ---- Color: amber ---- */
.chip--amber:hover:not(:disabled) {
  border-color: #D97706;
  color: #D97706;
}

.chip--amber.chip--active {
  background: #D97706;
  border-color: #D97706;
  color: white;
  font-weight: 600;
}

.chip--amber.chip--active:hover:not(:disabled) {
  background: #B45309;
  border-color: #B45309;
  color: white;
}
</style>

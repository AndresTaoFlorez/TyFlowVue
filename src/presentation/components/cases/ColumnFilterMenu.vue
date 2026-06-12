<script setup>
import { ref, computed, onUnmounted } from 'vue'

// Mini menú contextual de filtro para headers de columna de la tabla de casos.
// Se monta dentro del <th>; al hacer clic despliega las opciones con checkmark.
// modelValue null = sin filtro ("Todos").
const props = defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true }, // [{ value, label, color?, bg? }]
  modelValue: { type: [String, null], default: null },
  allLabel: { type: String, default: 'Todos' },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const triggerEl = ref(null)

const activeOption = computed(() =>
  props.options.find(o => o.value === props.modelValue) ?? null
)

function toggle() {
  open.value ? close() : openMenu()
}

function openMenu() {
  open.value = true
  document.addEventListener('mousedown', onDocDown, true)
  document.addEventListener('keydown', onDocKey, true)
}

function close() {
  open.value = false
  document.removeEventListener('mousedown', onDocDown, true)
  document.removeEventListener('keydown', onDocKey, true)
}

function onDocDown(e) {
  if (!triggerEl.value?.contains(e.target)) close()
}

function onDocKey(e) {
  if (e.key === 'Escape') close()
}

function select(value) {
  emit('update:modelValue', value)
  close()
}

onUnmounted(close)
</script>

<template>
  <div ref="triggerEl" class="cfm">
    <button
      class="cfm__trigger"
      :class="{ 'cfm__trigger--active': modelValue != null, 'cfm__trigger--open': open }"
      type="button"
      @click.stop="toggle"
    >
      <span class="cfm__label">{{ label }}</span>
      <span v-if="activeOption" class="cfm__value" :style="activeOption.color ? { color: activeOption.color } : {}">
        · {{ activeOption.label }}
      </span>
      <i class="bx cfm__caret" :class="open ? 'bx-chevron-up' : 'bx-chevron-down'"></i>
    </button>

    <Transition name="cfm-pop">
      <div v-if="open" class="cfm__menu" @mousedown.stop>
        <button
          class="cfm__item"
          :class="{ 'cfm__item--selected': modelValue == null }"
          type="button"
          @click="select(null)"
        >
          <i class="bx bx-check cfm__check" :style="{ visibility: modelValue == null ? 'visible' : 'hidden' }"></i>
          {{ allLabel }}
        </button>
        <div class="cfm__sep"></div>
        <button
          v-for="o in options"
          :key="o.value"
          class="cfm__item"
          :class="{ 'cfm__item--selected': modelValue === o.value }"
          type="button"
          @click="select(o.value)"
        >
          <i class="bx bx-check cfm__check" :style="{ visibility: modelValue === o.value ? 'visible' : 'hidden' }"></i>
          <span v-if="o.color" class="cfm__dot" :style="{ background: o.color }"></span>
          {{ o.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.cfm {
  position: relative;
  display: inline-flex;
}

.cfm__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.3rem;
  margin: -0.15rem -0.3rem;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.cfm__trigger:hover,
.cfm__trigger--open {
  background: color-mix(in srgb, var(--primary-500) 10%, transparent);
  color: var(--text-primary);
}
.cfm__trigger--active { color: var(--primary-500); }
.cfm__trigger--active:hover { color: var(--primary-600); }

.cfm__value {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 700;
}

.cfm__caret { font-size: 0.85rem; }

.cfm__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 160px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(10, 16, 32, 0.22);
  padding: 0.3rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.cfm__item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.42rem 0.55rem;
  border: none;
  background: none;
  border-radius: 7px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-primary);
  text-align: left;
  text-transform: none;
  letter-spacing: 0;
  transition: background 0.1s;
  white-space: nowrap;
}
.cfm__item:hover { background: color-mix(in srgb, var(--bg-card) 60%, var(--border-light)); }
.cfm__item--selected { font-weight: 700; color: var(--primary-500); }

.cfm__check {
  font-size: 0.95rem;
  color: var(--primary-500);
  flex-shrink: 0;
}

.cfm__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cfm__sep {
  height: 1px;
  background: var(--border-light);
  margin: 0.2rem 0.3rem;
}

.cfm-pop-enter-active, .cfm-pop-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.cfm-pop-enter-from, .cfm-pop-leave-to { opacity: 0; transform: translateY(-4px); }
</style>

<script setup>
import ChipSelect from '@/presentation/components/ChipSelect.vue'

defineProps({
  supportLevels: { type: Array, required: true },
  applications: { type: Array, required: true },
  selectedSupportLevelIds: { type: Array, required: true },
  selectedApplicationIds: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  supportLevelError: { type: String, default: null },
})

defineEmits(['update:selectedSupportLevelIds', 'update:selectedApplicationIds'])
</script>

<template>
  <div class="specialist-fields">
    <ChipSelect
      :options="supportLevels"
      :model-value="selectedSupportLevelIds"
      label="Niveles de Soporte *"
      icon="bx-layer"
      color="primary"
      :loading="loading"
      :disabled="disabled"
      :error="supportLevelError"
      empty-text="Sin niveles disponibles"
      @update:model-value="$emit('update:selectedSupportLevelIds', $event)"
    />
    <ChipSelect
      :options="applications"
      :model-value="selectedApplicationIds"
      label="Aplicaciones"
      icon="bx-grid-alt"
      color="indigo"
      :loading="loading"
      :disabled="disabled"
      empty-text="Sin aplicaciones disponibles"
      @update:model-value="$emit('update:selectedApplicationIds', $event)"
    />
  </div>
</template>

<style scoped>
.specialist-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>

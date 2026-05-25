<script setup>
defineProps({
  application: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  specialistCount: { type: Number, default: null },
})

defineEmits(['select', 'delete'])
</script>

<template>
  <div
    class="app-card"
    :class="{ 'app-card--selected': selected }"
    @click="$emit('select', application)"
  >
    <div class="app-card__icon">
      <i class='bx bx-cube'></i>
    </div>
    <div class="app-card__body">
      <h3 class="app-card__name">{{ application.name }}</h3>
      <span v-if="specialistCount !== null" class="app-card__count">
        <i class='bx bx-user'></i> {{ specialistCount }} especialista{{ specialistCount !== 1 ? 's' : '' }}
      </span>
    </div>
    <button
      class="app-card__delete"
      title="Eliminar aplicación"
      @click.stop="$emit('delete', application)"
    >
      <i class='bx bx-trash'></i>
    </button>
  </div>
</template>

<style scoped>
.app-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.app-card:hover {
  border-color: var(--primary-500);
  box-shadow: 0 2px 8px rgba(42, 199, 143, 0.12);
}

.app-card--selected {
  border-color: var(--primary-500);
  background: rgba(42, 199, 143, 0.04);
  box-shadow: 0 2px 8px rgba(42, 199, 143, 0.15);
}

.app-card__icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.15rem;
  flex-shrink: 0;
}

.app-card__body {
  flex: 1;
  min-width: 0;
}

.app-card__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-card__count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
}

.app-card__count i {
  font-size: 0.85rem;
}

.app-card__delete {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.1rem;
  padding: 0.35rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.app-card:hover .app-card__delete {
  opacity: 1;
}

.app-card__delete:hover {
  color: var(--error-500);
  background: var(--error-bg);
}
</style>

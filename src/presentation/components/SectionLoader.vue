<script setup>
defineProps({
  message: { type: String, default: 'Cargando...' },
})
</script>

<template>
  <div class="section-loader">
    <i class='bx bx-loader-alt bx-spin'></i>
    {{ message }}
  </div>
</template>

<style scoped>
.section-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.section-loader i {
  font-size: 1.2rem;
}
</style>
